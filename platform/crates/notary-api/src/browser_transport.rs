//! Explicit browser origins for the two SPAs. Native clients have no Origin.
use axum::{
    extract::{Request, State},
    http::{HeaderValue, Method, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use axum_extra::extract::cookie::CookieJar;

use crate::{ErrorResponse, SESSION_COOKIE, config::PublicOrigins};

pub(crate) async fn browser_access(
    State(origins): State<PublicOrigins>,
    request: Request,
    next: Next,
) -> Response {
    let origin = request.headers().get(header::ORIGIN).cloned();
    let allowed = origin.as_ref().is_some_and(|value| {
        [&origins.api, &origins.capture, &origins.website]
            .into_iter()
            .chain(origins.additional_browser_origins.iter())
            .any(|url| value.as_bytes() == url.origin().ascii_serialization().as_bytes())
    });
    let unsafe_method = !matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    );
    let cookies = CookieJar::from_headers(request.headers());
    let browser_cookie =
        cookies.get(SESSION_COOKIE).is_some() || cookies.get("notary_trace_access").is_some();
    if (origin.is_some() && !allowed) || (unsafe_method && browser_cookie && !allowed) {
        return denied();
    }
    let preflight = request.method() == Method::OPTIONS
        && request
            .headers()
            .contains_key(header::ACCESS_CONTROL_REQUEST_METHOD);
    let mut response = if preflight {
        let method = request
            .headers()
            .get(header::ACCESS_CONTROL_REQUEST_METHOD)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        let headers_allowed = request
            .headers()
            .get(header::ACCESS_CONTROL_REQUEST_HEADERS)
            .and_then(|value| value.to_str().ok())
            .is_none_or(|value| {
                value.split(',').all(|name| {
                    matches!(
                        name.trim().to_ascii_lowercase().as_str(),
                        "content-type"
                            | "authorization"
                            | "x-notary-poll-secret"
                            | "x-notary-approval-secret"
                    )
                })
            });
        if !allowed
            || !headers_allowed
            || !matches!(method, "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE")
        {
            return denied();
        }
        StatusCode::NO_CONTENT.into_response()
    } else {
        next.run(request).await
    };
    response.headers_mut().append(
        header::VARY,
        HeaderValue::from_static(
            "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        ),
    );
    if let Some(origin) = origin.filter(|_| allowed) {
        let headers = response.headers_mut();
        headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
        headers.insert(
            header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            HeaderValue::from_static("true"),
        );
        headers.insert(
            header::ACCESS_CONTROL_EXPOSE_HEADERS,
            HeaderValue::from_static("Content-Disposition"),
        );
        if preflight {
            headers.insert(
                header::ACCESS_CONTROL_ALLOW_METHODS,
                HeaderValue::from_static("GET, HEAD, POST, PUT, PATCH, DELETE"),
            );
            headers.insert(
                header::ACCESS_CONTROL_ALLOW_HEADERS,
                HeaderValue::from_static(
                    "Content-Type, Authorization, X-Notary-Poll-Secret, X-Notary-Approval-Secret",
                ),
            );
        }
    }
    response
}

fn denied() -> Response {
    (
        StatusCode::FORBIDDEN,
        [
            (header::CACHE_CONTROL, "no-store"),
            (header::VARY, "Origin"),
        ],
        axum::Json(ErrorResponse {
            error: "browser_origin_denied",
            message: "This browser origin is not allowed",
        }),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Router, body::Body, middleware, routing::get};
    use tower::ServiceExt;
    use url::Url;

    fn app() -> Router {
        let origins = PublicOrigins {
            api: Url::parse("https://api.example.com").unwrap(),
            capture: Url::parse("https://capture.example.com").unwrap(),
            website: Url::parse("https://example.com").unwrap(),
            additional_browser_origins: vec![Url::parse("https://www.example.com").unwrap()],
        };
        Router::new()
            .route(
                "/api/test",
                get(|| async { "ok" }).post(|| async { "changed" }),
            )
            .layer(middleware::from_fn_with_state(origins, browser_access))
    }

    #[tokio::test]
    async fn permits_exact_spa_origins_and_handles_preflight() {
        for origin in [
            "https://capture.example.com",
            "https://example.com",
            "https://www.example.com",
        ] {
            let response = app()
                .oneshot(
                    Request::builder()
                        .method("OPTIONS")
                        .uri("/api/test")
                        .header(header::ORIGIN, origin)
                        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(
                            header::ACCESS_CONTROL_REQUEST_HEADERS,
                            "content-type, authorization",
                        )
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::NO_CONTENT);
            assert_eq!(
                response.headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN],
                origin
            );
            assert_eq!(
                response.headers()[header::ACCESS_CONTROL_ALLOW_CREDENTIALS],
                "true"
            );
        }
    }

    #[tokio::test]
    async fn rejects_untrusted_origins_and_cookie_writes_without_origin() {
        for origin in [
            None,
            Some("null"),
            Some("https://capture.example.com.evil.test"),
        ] {
            let mut request = Request::builder()
                .method("POST")
                .uri("/api/test")
                .header(header::COOKIE, format!("{SESSION_COOKIE}=fixture"));
            if let Some(origin) = origin {
                request = request.header(header::ORIGIN, origin);
            }
            let response = app()
                .oneshot(request.body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::FORBIDDEN);
            assert!(
                !response
                    .headers()
                    .contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            );
        }
    }

    #[tokio::test]
    async fn permits_native_requests_and_authenticated_spa_writes() {
        for browser in [false, true] {
            let mut request = Request::builder().method("POST").uri("/api/test");
            if browser {
                request = request
                    .header(header::ORIGIN, "https://capture.example.com")
                    .header(header::COOKIE, format!("{SESSION_COOKIE}=fixture"));
            } else {
                request = request.header(header::AUTHORIZATION, "Bearer fixture");
            }
            assert_eq!(
                app()
                    .oneshot(request.body(Body::empty()).unwrap())
                    .await
                    .unwrap()
                    .status(),
                StatusCode::OK
            );
        }
    }
}
