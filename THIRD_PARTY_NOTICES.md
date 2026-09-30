# Third-party notices

Joinery includes open-source software. This summary identifies the principal runtime components; the lockfiles contain the complete dependency graph.

| Component                                                | Purpose                       | License                                      |
| -------------------------------------------------------- | ----------------------------- | -------------------------------------------- |
| React / React DOM                                        | User interface                | MIT                                          |
| AntV X6, selection, and minimap plugins                  | SVG diagram editor            | MIT                                          |
| ELK.js                                                   | Automatic graph layout        | EPL-2.0 (GPL-3.0-or-later secondary license) |
| Zustand                                                  | Application state             | MIT                                          |
| Immer                                                    | Immutable state updates       | MIT                                          |
| Zod                                                      | Runtime document validation   | MIT                                          |
| Lucide React                                             | Icons                         | ISC                                          |
| Tauri and dialog/process/updater/single-instance plugins | Desktop runtime               | Apache-2.0 OR MIT                            |
| resvg / usvg / tiny-skia                                 | SVG parsing and PNG rendering | Apache-2.0 OR MIT                            |
| svg2pdf / pdf-writer                                     | Vector PDF generation         | Apache-2.0 OR MIT                            |

## ELK.js

ELK.js is distributed under the Eclipse Public License 2.0, with GPL-3.0-or-later as a secondary license. Joinery uses the unmodified npm distribution. Source and license information are available at:

- https://github.com/kieler/elkjs
- https://www.eclipse.org/legal/epl-2.0/

## Complete audit

Run the repository license policy check against all production npm and Cargo dependencies:

```bash
npm run licenses
```

Individual copyright notices and complete license texts remain available in each dependency's package or crate distribution. This file is informational and does not replace those license texts.
