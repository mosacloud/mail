import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/500.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@blocknote/mantine/style.css";
import "./styles/main.scss";

import { bootstrap } from "./bootstrap";
import { installRandomUUIDPolyfill } from "@/features/utils/uuid";

// Must run before anything renders: third-party components (the ui-kit
// FileUploader) call `crypto.randomUUID()` unguarded, and it is undefined
// outside a secure context.
installRandomUUIDPolyfill();

void bootstrap();
