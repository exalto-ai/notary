import { Alert, Anchor, Box, Button, Group, Text } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import {
  claimCreditOffer,
  createBillingPortalSession,
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  getBillingPurchases,
  getCreditOffers,
} from '../../../platform-api/client';
import { listingDate, sessionDate } from '../../../site/format';
import { Data, Fact, Facts, Lamp, Meter, SectionHead } from '../../components/primitives';
import type { Account } from '../../data/account';
import {
  type BillingPurchase,
  type CheckoutOutcome,
  checkoutMessages,
  useCheckoutReturn,
} from '../../data/billing';
import { bytes, percent } from '../../format';
import { planLabel, planPrice } from '../../plan';

type CreditOffer = Awaited<ReturnType<typeof getCreditOffers>>[number];

function message(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

function outcomeTone(outcome: CheckoutOutcome) {
  if (outcome === 'paid') return 'custody';
  if (outcome === 'waiting') return 'seal';
  return 'alert';
}

function Allowance({
  label,
  used,
  total,
  note,
}: {
  label: string;
  used: number;
  total: number;
  note: string;
}) {
  // Red is for a real problem, and an allowance mostly spent is one.
  const tone = total > 0 && used / total >= 0.9 ? 'alert' : undefined;
  return (
    <Box p="md" style={{ minWidth: 0 }}>
      <Group justify="space-between" align="baseline" gap="sm">
        <Text fz={14} fw={570}>
          {label}
        </Text>
        <Data c={tone ? 'var(--x-alert)' : 'var(--x-quiet)'}>{percent(used, total)} used</Data>
      </Group>
      <Box mt={12}>
        <Meter used={used} total={total} tone={tone} />
      </Box>
      <Data c="var(--x-quiet)" mt={10} style={{ display: 'block' }}>
        {bytes(Math.max(total - used, 0))} left of {bytes(total)}
      </Data>
      <Text fz={12.5} c="var(--x-faint)" mt={4}>
        {note}
      </Text>
    </Box>
  );
}

export function Usage({
  account,
  route,
  onAccountChanged,
  loadOffers = getCreditOffers,
  claimOffer = claimCreditOffer,
  loadPurchases = getBillingPurchases,
  startCheckout = createCheckoutSession,
  startSubscription = createSubscriptionCheckoutSession,
  startPortal = createBillingPortalSession,
  openCheckout = (url: string) => window.location.assign(url),
}: {
  account: Account;
  route: string;
  onAccountChanged: () => void;
  loadOffers?: typeof getCreditOffers;
  claimOffer?: typeof claimCreditOffer;
  loadPurchases?: typeof getBillingPurchases;
  startCheckout?: typeof createCheckoutSession;
  startSubscription?: typeof createSubscriptionCheckoutSession;
  startPortal?: typeof createBillingPortalSession;
  openCheckout?: (url: string) => void;
}) {
  const { billing, usage } = account;
  const capture = usage.credits.capture;
  const sealing = usage.credits.notarization;
  const storageLimit = billing.entitlements.trace_storage_bytes ?? 0;

  const parameters = new URLSearchParams(route.split('?')[1] ?? '');
  const [purchases, setPurchases] = useState<BillingPurchase[] | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [offers, setOffers] = useState<CreditOffer[] | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const purchaseSettled = useCallback(
    (purchase: BillingPurchase) => {
      setPurchases((current) => [
        purchase,
        ...(current ?? []).filter((item) => item.id !== purchase.id),
      ]);
      onAccountChanged();
    },
    [onAccountChanged],
  );

  const { outcome, error: pollError } = useCheckoutReturn({
    checkout: parameters.get('checkout'),
    purchaseId: parameters.get('purchase_id'),
    onSettled: purchaseSettled,
  });

  useEffect(() => {
    let cancelled = false;
    loadPurchases()
      .then((items) => {
        if (!cancelled) setPurchases(items);
      })
      .catch((reason) => {
        if (!cancelled) setPurchaseError(message(reason, 'Could not load purchases.'));
      });
    return () => {
      cancelled = true;
    };
  }, [loadPurchases]);

  useEffect(() => {
    let cancelled = false;
    loadOffers()
      .then((items) => {
        if (!cancelled) setOffers(items);
      })
      .catch((reason) => {
        if (!cancelled) setOfferError(message(reason, 'Could not load available offers.'));
      });
    return () => {
      cancelled = true;
    };
  }, [loadOffers]);

  const purchaseMode = billing.purchase_mode ?? 'disabled';
  const canBuy = purchaseMode === 'test' || purchaseMode === 'live';
  const canSubscribe = canBuy && billing.subscriptions_configured === true;
  const subscribed = billing.plan !== 'free';

  // Each endpoint names its redirect differently; the reader only needs to
  // arrive at Stripe.
  const begin = async (what: string, run: () => Promise<Record<string, unknown>>) => {
    setStarting(what);
    setCheckoutError(null);
    try {
      const session = await run();
      const url = session.checkout_url ?? session.portal_url ?? session.url;
      if (typeof url !== 'string') throw new Error('Stripe did not return a destination.');
      openCheckout(url);
    } catch (reason) {
      setCheckoutError(message(reason, 'Could not start Stripe Checkout.'));
      setStarting(null);
    }
  };

  const claim = async (offer: CreditOffer) => {
    setClaiming(offer.id);
    setOfferError(null);
    try {
      await claimOffer(offer.id);
      setOffers((current) => (current ?? []).filter((item) => item.id !== offer.id));
      onAccountChanged();
    } catch (reason) {
      setOfferError(message(reason, 'Could not claim this offer.'));
    } finally {
      setClaiming(null);
    }
  };

  return (
    <>
      {outcome ? (
        <Alert
          mb="md"
          variant="light"
          color={outcomeTone(outcome) === 'alert' ? 'alert' : 'seal'}
          title={checkoutMessages[outcome]}
        >
          {pollError ?? null}
        </Alert>
      ) : null}

      <Box className="x-record" p="lg">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Box>
            <Group gap={12} align="baseline">
              <Text fz={27} fw={600} className="x-display" lh={1.1}>
                {planLabel(billing.plan)}
              </Text>
              {billing.billing_status === 'review' ? (
                <Lamp tone="alert">Needs attention</Lamp>
              ) : (
                <Lamp tone="sealed">Active</Lamp>
              )}
            </Group>
            <Data c="var(--x-quiet)" mt={4} style={{ display: 'block' }}>
              {planPrice(billing.plan)}, allowances reset {listingDate(usage.credits.reset_at)}
            </Data>
          </Box>
          <Group gap={10}>
            {subscribed && canBuy ? (
              <Button
                variant="default"
                h={36}
                loading={starting === 'portal'}
                onClick={() => begin('portal', startPortal)}
              >
                Manage subscription
              </Button>
            ) : null}
            {!subscribed && canSubscribe ? (
              <>
                <Button
                  variant="default"
                  h={36}
                  loading={starting === 'one_gb'}
                  onClick={() =>
                    begin('one_gb', () => startSubscription('one_gb', crypto.randomUUID()))
                  }
                >
                  1 GB, {planPrice('one_gb')}
                </Button>
                <Button
                  h={36}
                  loading={starting === 'ten_gb'}
                  onClick={() =>
                    begin('ten_gb', () => startSubscription('ten_gb', crypto.randomUUID()))
                  }
                >
                  10 GB, {planPrice('ten_gb')}
                </Button>
              </>
            ) : null}
          </Group>
        </Group>
        {!canSubscribe && !subscribed ? (
          <Text fz={12.5} c="var(--x-quiet)" mt="md">
            New subscriptions are not available on this deployment right now.
          </Text>
        ) : null}
        {checkoutError ? (
          <Alert color="alert" variant="light" mt="md">
            {checkoutError}
          </Alert>
        ) : null}
      </Box>

      <Text fz="sm" c="var(--x-quiet)" mt="md" maw="var(--x-measure)">
        Capture and sealing have separate monthly allowances. Extra sealing you buy outright adds to
        the sealing allowance only, and it does not expire.
      </Text>

      <Box
        className="x-grid"
        mt="lg"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
      >
        <Allowance
          label="Capture"
          used={capture.total_used_bytes}
          total={capture.total_granted_bytes}
          note="Bytes recorded through the local proxy and settled against this account."
        />
        <Allowance
          label="Sealing"
          used={sealing.total_used_bytes}
          total={sealing.total_granted_bytes}
          note="Bytes turned into signed evidence by Exalto Seal."
        />
        <Allowance
          label="Trace storage"
          used={usage.hosted_traces.stored_bytes}
          total={storageLimit}
          note="Packages hosted at a link you can share."
        />
      </Box>

      {sealing.supplemental_remaining_bytes > 0 ? (
        <Text fz={12.5} c="var(--x-quiet)" mt="sm">
          <Data>{bytes(sealing.supplemental_remaining_bytes)}</Data> of that sealing was bought
          outright and is used only after the monthly allowance runs out.
        </Text>
      ) : null}

      {offers === null ? null : offers.length > 0 ? (
        <Box mt={40}>
          <SectionHead title="Available to claim" />
          <Box className="x-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {offers.map((offer) => (
              <Group key={offer.id} justify="space-between" gap="md" p="md" wrap="wrap">
                <Box miw={0}>
                  <Text fz={14} fw={560}>
                    {offer.title}
                  </Text>
                  <Text fz={12.5} c="var(--x-quiet)" mt={2}>
                    {offer.description}
                  </Text>
                  <Data c="var(--x-faint)" mt={4} style={{ display: 'block' }}>
                    {bytes(offer.amount_bytes)}
                    {offer.claim_expires_at
                      ? `, claim by ${listingDate(offer.claim_expires_at)}`
                      : ''}
                  </Data>
                </Box>
                <Button
                  variant="default"
                  h={34}
                  loading={claiming === offer.id}
                  onClick={() => claim(offer)}
                >
                  Claim
                </Button>
              </Group>
            ))}
          </Box>
          {offerError ? (
            <Alert color="alert" variant="light" mt="md">
              {offerError}
            </Alert>
          ) : null}
        </Box>
      ) : null}

      <Box mt={40}>
        <SectionHead title="Buy more sealing">
          Sealing you buy outright is added once Stripe confirms the payment. It does not expire,
          and it is used only after the monthly allowance runs out.
        </SectionHead>
        {canBuy ? (
          <Box className="x-record" p="md">
            <Group justify="space-between" gap="md" wrap="wrap">
              <Box>
                <Text fz={14} fw={560}>
                  1 GB of sealing
                </Text>
                <Text fz={12.5} c="var(--x-quiet)" mt={2}>
                  One payment. {purchaseMode === 'test' ? 'Stripe is in test mode here.' : ''}
                </Text>
              </Box>
              <Button
                variant="default"
                h={36}
                loading={starting === 'credits'}
                onClick={() => begin('credits', () => startCheckout(1, crypto.randomUUID()))}
              >
                Buy 1 GB
              </Button>
            </Group>
          </Box>
        ) : (
          <Box className="x-record" p="md">
            <Text fz="sm" c="var(--x-quiet)">
              Buying extra sealing is not available on this deployment right now.
            </Text>
          </Box>
        )}
      </Box>

      <Box mt={40}>
        <SectionHead title="Purchases" />
        {purchaseError ? (
          <Alert color="alert" variant="light" title="Purchases could not be loaded">
            {purchaseError}
          </Alert>
        ) : purchases === null ? (
          <Box className="x-record" p="md">
            <Box className="x-skeleton" h={44} mb={1} />
            <Box className="x-skeleton" h={44} />
          </Box>
        ) : purchases.length === 0 ? (
          <Box className="x-record" p="md">
            <Text fz="sm" c="var(--x-quiet)">
              No purchase yet.
            </Text>
          </Box>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <table className="x-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>What</th>
                  <th>State</th>
                  <th className="x-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      <Data c="var(--x-quiet)">
                        {sessionDate(purchase.paid_at ?? purchase.created_at)}
                      </Data>
                    </td>
                    <td>
                      {purchase.quantity_gb} GB of sealing
                      <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                        {bytes(purchase.credit_bytes)}
                      </Data>
                    </td>
                    <td>
                      <Lamp
                        tone={
                          purchase.state === 'paid'
                            ? 'sealed'
                            : purchase.state === 'failed' ||
                                purchase.state === 'refunded' ||
                                purchase.state === 'disputed'
                              ? 'alert'
                              : 'idle'
                        }
                      >
                        {purchase.state}
                      </Lamp>
                    </td>
                    <td className="x-right">
                      <Data>{money(purchase.amount_cents, purchase.currency)}</Data>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Box>

      <Box mt={40}>
        <SectionHead title="How the numbers are counted" />
        <Box className="x-record" p="lg" maw={680}>
          <Facts>
            <Fact label="Capture">
              Bytes the local proxy relayed, settled when the session ends.
            </Fact>
            <Fact label="Sealing">Bytes of a capture that were turned into signed evidence.</Fact>
            <Fact label="Storage">
              Size of the packages currently hosted for your shared traces.
            </Fact>
            <Fact label="Reset">
              Monthly allowances reset on {listingDate(usage.credits.reset_at)}. Sealing bought
              outright does not reset.
            </Fact>
          </Facts>
        </Box>
        <Text fz={12.5} c="var(--x-quiet)" mt="sm">
          Allowances are enforced by the service.{' '}
          <Anchor href="#/docs/hosted-credits" fz={12.5} c="var(--x-seal)">
            Plans and usage
          </Anchor>
        </Text>
      </Box>
    </>
  );
}
