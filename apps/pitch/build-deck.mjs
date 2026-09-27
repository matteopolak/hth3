import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = '/Users/matthew/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const build = path.join(here, '.build');
const out = path.join(here, 'out');
await fs.mkdir(build, { recursive: true });
await fs.mkdir(path.join(out, 'slides'), { recursive: true });
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);

const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const ink = '#171717';
const white = '#FFFFFF';
const muted = '#626262';
const coral = '#D54438';
const pale = '#F7F7F5';
const font = 'Arial';

function text(slide, content, x, y, w, h, size, color = ink, bold = false) {
  const s = slide.shapes.add({
    geometry: 'textbox',
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { fill: 'none', width: 0 },
  });
  s.text = content;
  s.text.style = {
    typeface: font,
    fontSize: size,
    bold,
    color,
    autoFit: 'none',
  };
  return s;
}

function slide(bg = white) {
  const s = p.slides.add();
  s.background.fill = bg;
  return s;
}

const s1 = slide(ink);
text(s1, 'envoy', 82, 144, 900, 150, 122, white, true);
text(s1, 'Public services, clearer next steps', 88, 310, 1080, 92, 43, white);
text(s1, 'Hack the Hill III  /  Civic Technology', 88, 582, 950, 48, 23, '#CECECE');
text(s1, '.', 422, 126, 120, 145, 130, coral, true);
s1.speakerNotes.textFrame.setText('0:00–0:20. A resident needs an answer, but public information is spread across many sites. Envoy helps them find the official source, understand the next step, and raise a concern without guessing who receives it. Source: https://tracker.hackthehill.com/resources.');

const s2 = slide(pale);
text(s2, 'The civic handoff', 78, 70, 1110, 86, 65, ink, true);
text(s2, 'People need the right public source.', 80, 212, 1100, 60, 41, ink);
text(s2, 'They need to know who receives an action.', 80, 300, 1100, 60, 41, ink);
text(s2, 'Envoy makes both visible before they continue.', 80, 388, 1100, 60, 41, ink);
text(s2, 'Official applications stay with publishers. Reports here reach Envoy’s review team.', 82, 566, 1100, 80, 26, muted);
s2.speakerNotes.textFrame.setText('0:20–0:48. We serve residents navigating Canadian public services and opportunities. The institutions are official public publishers of jobs, services, and programs. Envoy links to those publishers. Reports submitted here today reach Envoy’s own review team. No municipality or employer participates yet. Civic track guidance: https://tracker.hackthehill.com/resources.');

const s3 = slide(white);
text(s3, 'Ask Envoy, then act', 76, 62, 1110, 84, 64, ink, true);
text(s3, '1   Ottawa jobs and dates', 78, 195, 430, 58, 28, ink);
text(s3, '2   Ontario training help', 78, 278, 430, 58, 28, ink);
text(s3, '3   An Ottawa office', 78, 361, 430, 58, 28, ink);
text(s3, '4   Review Toronto feedback', 78, 444, 430, 58, 28, ink);
text(s3, 'Open envoy.surf', 79, 583, 420, 58, 31, coral, true);
const nearbyScreenshot = await fs.readFile(path.join(here, 'assets/chat-ottawa-jobs-2026-09-27.png'));
s3.images.add({
  blob: nearbyScreenshot,
  contentType: 'image/png',
  alt: 'Actual Envoy chat answer listing ten City of Ottawa jobs, closing dates, and ten official sources',
  fit: 'contain',
  position: { left: 520, top: 170, width: 700, height: 475 },
});
s3.speakerNotes.textFrame.setText('0:48–3:50. Switch to the prepared browser. Ask the guest assistant for current City of Ottawa vacancies, Ontario retraining support, and an Ottawa service office in separate fresh chats. The verified answers show individual job closing dates and ten official sources, Better Jobs Ontario, and the ServiceOntario St. Joseph Boulevard office. For a separate Toronto product concern, use the typed Feedback form as the reliable review and receipt path. Ottawa civic reports have no Envoy destination. A source link does not submit an external application. See docs/judging/demo-runbook.md.');

const s4 = slide(ink);
text(s4, 'One Worker, clear boundaries', 76, 60, 1120, 87, 62, white, true);
text(s4, 'Official sources', 82, 206, 330, 58, 34, white, true);
text(s4, 'Publisher link\nFreshness\nIndividual records', 82, 277, 330, 178, 26, '#D6D6D6');
text(s4, 'Agent actions', 465, 206, 338, 58, 34, white, true);
text(s4, 'Workers AI + typed tools\nHuman approval\nWorker role checks', 465, 277, 355, 178, 26, '#D6D6D6');
text(s4, 'Private proof', 858, 206, 330, 58, 34, white, true);
text(s4, 'D1 receipt and outbox\nR2 private files\nTiger event trends', 858, 277, 330, 178, 26, '#D6D6D6');
text(s4, 'Report text stays out of analytics events.', 82, 572, 1080, 55, 30, '#F39D95');
s4.speakerNotes.textFrame.setText('3:50–4:40. One Cloudflare Worker serves the web app and /api. D1 stores sourced records, transactions, receipts, and an idempotent outbox; R2 is a private asset store. Workers AI proposes through typed tools. The Worker validates scope and approval before writes. The outbox sends privacy-limited metadata to Tiger Data for trends, not report message bodies. Technical evidence: docs/worker-platform.md; docs/agents/conversations.md; docs/analytics/tiger-data.md. The presentation rubric assigns Technical Execution 15 of 45 points: https://tracker.hackthehill.com/resources.');

const s5 = slide(pale);
text(s5, 'envoy.surf', 76, 190, 1120, 140, 108, ink, true);
text(s5, 'Find the source. Review the action.', 81, 352, 1070, 82, 43, ink);
text(s5, 'Questions', 82, 568, 900, 74, 33, coral, true);
s5.speakerNotes.textFrame.setText('4:40–5:00. The result is a clearer public-service handoff with a visible source and a truthful destination. Open envoy.surf and try the same path. We are ready for questions. Verify the custom domain before the presentation. Organizer format: 5-minute presentation and demo plus 3-minute Q&A: https://tracker.hackthehill.com/resources.');

const s6 = slide(white);
text(s6, 'Integration evidence', 77, 62, 1110, 85, 62, ink, true);
text(s6, 'Tiger Data', 80, 178, 330, 48, 35, ink, true);
text(s6, 'Delivered event metadata and aggregate trends', 430, 178, 760, 54, 26, muted);
text(s6, 'Auth0', 80, 270, 330, 48, 35, ink, true);
text(s6, 'JWT and role boundary built; live staff token pending', 430, 270, 760, 68, 26, muted);
text(s6, 'ElevenLabs', 80, 371, 330, 48, 35, ink, true);
text(s6, 'Signed call and follow-up; web handoff pending', 430, 371, 760, 68, 26, muted);
text(s6, 'Presage', 80, 472, 330, 48, 35, ink, true);
text(s6, 'Native integration; physical iPhone signal pending', 430, 472, 760, 68, 26, muted);
text(s6, 'Backup for Q&A', 82, 610, 1000, 40, 23, coral, true);
s6.speakerNotes.textFrame.setText('Backup only, not part of the five-minute pitch. Tiger Data has dated delivery evidence; refresh a read-only query for the panel. Auth0 hosted sign-in and Worker JWT rejection have evidence, but a real staff-role action is not accepted. ElevenLabs issued a signed URL and one verified call produced a nearest-intersection follow-up; the web microphone-to-draft handoff is not accepted. Presage compiles in SwiftUI; stable physical device signal is not accepted. See docs/submission-checklist.md and docs/judging/q-and-a.md. Never claim provider end-to-end acceptance from configuration or simulator footage.');

const candidate = path.join(build, 'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
for (let i = 0; i < p.slides.items.length; i++) {
  const png = await p.export({ slide: p.slides.items[i], format: 'png', scale: 1 });
  await fs.writeFile(path.join(out, 'slides', `slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
}

const final = path.join(out, 'envoy-judges-2026-v6.pptx');
await finalizePresentation({
  workspaceDir: here,
  candidatePath: candidate,
  finalPath: final,
  pythonExecutable: '/Users/matthew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit'],
  requiredNativeTableOwnerSlides: [],
  fontPolicy: { basis: 'design', families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(build, 'envoy-judges-2026-v6.validation.json'),
});
console.log(final);
