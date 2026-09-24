// Every stylesheet the application renders with, in one place, so the browser
// tests load exactly what a visitor loads. When these lived only in the entry
// module the tests ran with no CSS at all, which let a broken cascade ship.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/geist-mono';
// The whole Mantine bundle, in Mantine's own order. Importing a hand-picked
// subset saved 154kB and broke the cascade: UnstyledButton's transparent
// background has to load before Button's filled one, and an alphabetical list
// put it after, which silently unstyled every primary button and the account
// menu. Trim this again only by preserving upstream order, and check a built
// page rather than trusting that the build succeeded.
import '@mantine/core/styles.css';
import './system.css';
