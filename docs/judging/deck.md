# Judge deck

## What it is

An editable six-slide PowerPoint for the Hack the Hill III Civic Technology panel. Slides 1–5 support the five-minute pitch; slide 6 is an integration-evidence backup for Q&A. The output folder contains [the PPTX](../../apps/pitch/out/envoy-judges-2026-v6.pptx), [a PDF fallback](../../apps/pitch/out/envoy-judges-2026-v6.pdf), and [per-slide PNG previews](../../apps/pitch/out/slides/).

## How it works

`apps/pitch/build-deck.mjs` authors native text boxes and speaker notes with `@oai/artifact-tool`, exports a draft, validates the PPTX package and layout, and writes each slide preview. The deck uses large Arial text on a black-and-white canvas with one restrained red accent. Slide 3 uses a crop from the real September 27 `current-chat-jobs-envoy-surf` capture showing ten City of Ottawa roles and official sources; the live browser remains the central proof. The speaker notes cite the [organizer's current resources](https://tracker.hackthehill.com/resources) and repository evidence.

After generating the PPTX, LibreOffice converts it to PDF. The PPTX is editable; the PDF is a stage fallback. The [pitch script](pitch-script.md) gives the exact clock and speaking copy.

## How to change it

Edit the slide text and notes in `apps/pitch/build-deck.mjs`, then run it with the bundled presentation runtime. The finalizer refuses to overwrite an existing output, so give the next approved revision a new filename and update this doc and the pitch script. Render and inspect every slide; a layout validator cannot judge the speaking flow. Keep claim changes synchronized with the demo and Q&A documents.

## Configuration

The script uses 1280×720 slides, Arial, and the bundled Codex presentation runtime's Node packages. Set `RUNTIME_NODE_MODULES` to the path returned by `load_workspace_dependencies`; run the script with that runtime's Node binary. The PDF conversion uses LibreOffice/`soffice` with a private profile. No provider API key is needed.

## Dependencies

`@oai/artifact-tool`, the bundled presentation finalizer, Arial, and LibreOffice. The deck's evidence statements depend on current Envoy production behavior and the [demo runbook](demo-runbook.md), not on the slide builder.
