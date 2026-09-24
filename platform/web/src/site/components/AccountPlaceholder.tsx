import { Box } from '@mantine/core';

/**
 * Loading holds the geometry it is about to replace, so nothing jumps when the
 * account arrives. Nothing is drawn until the wait is worth acknowledging.
 */
export function AccountPlaceholder() {
  return (
    <Box className="x-account" role="status" aria-label="Loading your account">
      <Box className="x-rail" aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <Box key={row} className="x-skeleton" h={32} my={1} />
        ))}
      </Box>
      <Box className="x-account-page" aria-hidden="true">
        <Box className="x-readouts">
          {[0, 1, 2, 3, 4].map((cell) => (
            <Box key={cell} className="x-readout">
              <Box className="x-skeleton" h={13} w="60%" />
              <Box className="x-skeleton" h={23} w="45%" mt={7} />
              <Box className="x-skeleton" h={12} w="70%" mt={6} />
            </Box>
          ))}
        </Box>
        <Box mt={40}>
          <Box className="x-skeleton" h={21} w={220} />
          <Box className="x-skeleton" h={220} mt={16} style={{ borderRadius: 6 }} />
        </Box>
      </Box>
    </Box>
  );
}
