import type {
  ApplicantProfileView,
  Locale,
  ResumeExtractionResponse,
  ResumeView,
} from "@civicresolve/contracts/v1";
import "./styles.css";

interface Options {
  locale: Locale;
  token: string | null;
}

interface ApplicationChoice {
  id: string;
  postingTitle: string;
  status: string;
}

type EntryKind = "education" | "experience";
type Entry = ApplicantProfileView[EntryKind][number];

const API = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");
const empty = (): ApplicantProfileView => ({
  name: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  skills: [],
  education: [],
  experience: [],
});

const copy = {
  en: {
    profile: "Profile",
    signIn:
      "Sign in as an applicant to manage your private profile and résumé.",
    loading: "Loading profile…",
    save: "Save profile",
    saved: "Profile saved.",
    name: "Name",
    email: "Email",
    phone: "Phone",
    location: "Location",
    summary: "Summary",
    skills: "Skills",
    skillsHint: "Separate skills with commas.",
    education: "Education",
    experience: "Experience",
    addEducation: "Add education",
    addExperience: "Add experience",
    remove: "Remove",
    institution: "Institution",
    credential: "Credential",
    fieldOfStudy: "Field of study",
    organization: "Organization",
    title: "Title",
    startDate: "Start date",
    endDate: "End date",
    description: "Description",
    resumes: "Résumés",
    upload: "Drop a PDF or DOCX, or choose a file",
    uploadButton: "Upload résumé",
    extract: "Review extracted text",
    delete: "Delete",
    expiry: "Stored until",
    extraction: "Suggestions from your résumé",
    extractionHint:
      "Each suggestion comes from the highlighted source text. Choose what to use, then save your profile.",
    apply: "Use in profile",
    used: "Added to profile draft",
    noSuggestions:
      "No supported fields found. You can enter your profile manually.",
    truncated:
      "The suggestion list was capped. Review the document and add any missing details manually.",
    share: "Share a résumé with an application",
    shareHint:
      "Only staff reviewing the selected application can access the résumé after you share it.",
    chooseResume: "Choose résumé",
    chooseApplication: "Choose application",
    shareButton: "Share with application",
    shared: "Résumé shared with this application.",
    noApplications: "Apply to a posting before sharing a résumé.",
    noResumes: "No résumés uploaded.",
    unknown: "Unknown",
    confirmDelete:
      "Delete this résumé? It will also be removed from any applications where you shared it.",
    deleted: "Résumé deleted.",
    maxSize: "PDF or DOCX, up to 5 MB.",
    contact: "Contact",
    extractText: "Source text",
  },
  fr: {
    profile: "Profil",
    signIn:
      "Connectez-vous comme candidat pour gérer votre profil et votre CV privés.",
    loading: "Chargement du profil…",
    save: "Enregistrer le profil",
    saved: "Profil enregistré.",
    name: "Nom",
    email: "Courriel",
    phone: "Téléphone",
    location: "Lieu",
    summary: "Résumé",
    skills: "Compétences",
    skillsHint: "Séparez les compétences par des virgules.",
    education: "Formation",
    experience: "Expérience",
    addEducation: "Ajouter une formation",
    addExperience: "Ajouter une expérience",
    remove: "Retirer",
    institution: "Établissement",
    credential: "Diplôme",
    fieldOfStudy: "Domaine d’études",
    organization: "Organisation",
    title: "Titre",
    startDate: "Date de début",
    endDate: "Date de fin",
    description: "Description",
    resumes: "CV",
    upload: "Déposez un PDF ou DOCX, ou choisissez un fichier",
    uploadButton: "Téléverser le CV",
    extract: "Examiner le texte extrait",
    delete: "Supprimer",
    expiry: "Conservé jusqu’au",
    extraction: "Suggestions tirées de votre CV",
    extractionHint:
      "Chaque suggestion vient du texte source affiché. Choisissez les données à utiliser, puis enregistrez le profil.",
    apply: "Utiliser dans le profil",
    used: "Ajouté au brouillon du profil",
    noSuggestions:
      "Aucun champ pris en charge trouvé. Vous pouvez saisir votre profil manuellement.",
    truncated:
      "La liste de suggestions est limitée. Examinez le document et ajoutez manuellement les détails manquants.",
    share: "Partager un CV avec une candidature",
    shareHint:
      "Seul le personnel qui examine la candidature choisie peut accéder au CV après votre partage.",
    chooseResume: "Choisir un CV",
    chooseApplication: "Choisir une candidature",
    shareButton: "Partager avec la candidature",
    shared: "CV partagé avec cette candidature.",
    noApplications: "Postulez à une offre avant de partager un CV.",
    noResumes: "Aucun CV téléversé.",
    unknown: "Inconnu",
    confirmDelete:
      "Supprimer ce CV? Il sera aussi retiré des candidatures où vous l’avez partagé.",
    deleted: "CV supprimé.",
    maxSize: "PDF ou DOCX, jusqu’à 5 Mo.",
    contact: "Coordonnées",
    extractText: "Texte source",
  },
} as const;

export function createProfilePage({ locale, token }: Options): HTMLElement {
  const text = copy[locale];
  const root = node("section", "profile-page");
  let draft = empty();
  let resumes: ResumeView[] = [];
  let applications: ApplicationChoice[] = [];
  let extraction: ResumeExtractionResponse["extraction"] | null = null;
  let applied = new Set<number>();
  let selectedResume = "";
  let selectedApplication = "";
  let file: File | null = null;
  let loading = !!token;
  let pending = "";
  let error = "";
  let notice = "";

  function captureDraft(): void {
    const form = root.querySelector<HTMLFormElement>(".profile-form");
    if (!form) return;
    const data = new FormData(form);
    for (const field of [
      "name",
      "email",
      "phone",
      "location",
      "summary",
    ] as const)
      draft[field] = String(data.get(field) ?? "").trim();
    draft.skills = String(data.get("skills") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    for (const kind of ["education", "experience"] as const) {
      const updated = draft[kind].map((entry, index) => {
        const update = { ...entry };
        for (const key of Object.keys(entry) as Array<keyof typeof entry>)
          update[key] = String(
            data.get(`${kind}.${index}.${key}`) ?? "",
          ).trim();
        return update;
      });
      if (kind === "education")
        draft.education = updated as ApplicantProfileView["education"];
      else draft.experience = updated as ApplicantProfileView["experience"];
    }
  }

  function render(): void {
    root.replaceChildren();
    if (!token) {
      root.append(node("p", "profile-muted", text.signIn));
      return;
    }
    if (loading) {
      root.append(node("p", "profile-muted", text.loading));
      return;
    }
    if (error) root.append(node("p", "profile-alert", error));
    if (notice) root.append(node("p", "profile-notice", notice));
    const workspace = node("div", "profile-workspace");
    const main = node("div", "profile-main");
    const aside = node("div", "profile-aside");
    main.append(profileForm());
    aside.append(resumeSection());
    if (extraction) aside.append(extractionSection());
    aside.append(shareSection());
    workspace.append(main, aside);
    root.append(workspace);
  }

  function profileForm(): HTMLElement {
    const form = node("form", "profile-form");
    form.append(node("h3", "profile-section-title", text.contact));
    const contact = node("div", "profile-contact-grid");
    for (const field of ["name", "email", "phone", "location"] as const)
      contact.append(
        fieldInput(
          text[field],
          field,
          draft[field],
          field === "email" ? "email" : "text",
        ),
      );
    form.append(contact, fieldArea(text.summary, "summary", draft.summary));
    form.append(fieldInput(text.skills, "skills", draft.skills.join(", ")));
    form.append(node("p", "profile-muted", text.skillsHint));
    for (const kind of ["education", "experience"] as const) {
      const section = node("section", "profile-entry-section");
      section.append(node("h3", "profile-section-title", text[kind]));
      draft[kind].forEach((entry, index) =>
        section.append(entryForm(kind, entry, index)),
      );
      section.append(
        action(
          kind === "education" ? text.addEducation : text.addExperience,
          "profile-button",
          () => {
            captureDraft();
            if (kind === "education")
              draft.education.push({
                institution: "",
                credential: "",
                fieldOfStudy: "",
                startDate: "",
                endDate: "",
                description: "",
              });
            else
              draft.experience.push({
                organization: "",
                title: "",
                startDate: "",
                endDate: "",
                description: "",
              });
            render();
          },
        ),
      );
      form.append(section);
    }
    const save = action(
      pending === "save" ? `${text.save}…` : text.save,
      "profile-button profile-button-primary",
    );
    save.type = "submit";
    save.disabled = !!pending;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void saveProfile();
    });
    form.append(save);
    return form;
  }

  function entryForm(
    kind: EntryKind,
    entry: Entry,
    index: number,
  ): HTMLElement {
    const wrapper = node("div", "profile-entry");
    const grid = node("div", "profile-entry-grid");
    for (const key of Object.keys(entry) as Array<keyof Entry>) {
      const name = `${kind}.${index}.${key}`;
      grid.append(
        key === "description"
          ? fieldArea(text[key], name, entry[key])
          : fieldInput(text[key], name, entry[key]),
      );
    }
    wrapper.append(
      grid,
      action(text.remove, "profile-button profile-button-quiet", () => {
        captureDraft();
        if (kind === "education") draft.education.splice(index, 1);
        else draft.experience.splice(index, 1);
        render();
      }),
    );
    return wrapper;
  }

  function resumeSection(): HTMLElement {
    const section = node("section", "profile-resume-section");
    section.append(node("h3", "profile-section-title", text.resumes));
    const upload = node("form", "profile-upload");
    const dropzone = node("label", "profile-dropzone");
    const input = document.createElement("input");
    input.type = "file";
    input.className = "profile-file-input";
    input.accept =
      ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    input.setAttribute("aria-label", text.upload);
    input.addEventListener("change", () => {
      captureDraft();
      file = input.files?.[0] ?? null;
      render();
    });
    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
    dropzone.addEventListener("dragleave", () =>
      dropzone.classList.remove("is-dragging"),
    );
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      captureDraft();
      file = event.dataTransfer?.files[0] ?? null;
      render();
    });
    dropzone.append(
      input,
      node("strong", "", file?.name ?? text.upload),
      node("span", "profile-muted", text.maxSize),
    );
    const uploadButton = action(
      pending === "upload" ? `${text.uploadButton}…` : text.uploadButton,
      "profile-button",
    );
    uploadButton.type = "submit";
    uploadButton.disabled = !!pending || !file;
    upload.addEventListener("submit", (event) => {
      event.preventDefault();
      void uploadResume();
    });
    upload.append(dropzone, uploadButton);
    section.append(upload);
    if (!resumes.length)
      section.append(node("p", "profile-muted", text.noResumes));
    for (const resume of resumes) {
      const row = node("div", "profile-resume-row");
      const info = node("div", "");
      info.append(node("strong", "", resume.filename));
      info.append(
        node(
          "span",
          "profile-muted",
          `${text.expiry} ${new Date(resume.retentionExpiresAt).toLocaleDateString(locale)}`,
        ),
      );
      const controls = node("div", "profile-row-actions");
      controls.append(
        action(text.extract, "profile-button", () => void extract(resume.id)),
      );
      controls.append(
        action(
          text.delete,
          "profile-button profile-button-quiet",
          () => void removeResume(resume.id),
        ),
      );
      row.append(info, controls);
      section.append(row);
    }
    return section;
  }

  function extractionSection(): HTMLElement {
    const section = node("section", "profile-extraction");
    section.append(node("h3", "profile-section-title", text.extraction));
    section.append(node("p", "profile-muted", text.extractionHint));
    if (extraction?.suggestionsTruncated)
      section.append(node("p", "profile-notice", text.truncated));
    if (!extraction?.suggestions.length)
      section.append(node("p", "profile-muted", text.noSuggestions));
    extraction?.suggestions.forEach((suggestion, index) => {
      const row = node("article", "profile-suggestion");
      row.append(node("strong", "", text[suggestion.field]));
      row.append(
        node(
          "p",
          "",
          Array.isArray(suggestion.value)
            ? suggestion.value.join(", ")
            : suggestion.value,
        ),
      );
      row.append(
        node(
          "small",
          "profile-muted",
          `${text.extractText}: “${suggestion.source.text}”`,
        ),
      );
      const use = action(
        applied.has(index) ? text.used : text.apply,
        "profile-button",
        () => {
          captureDraft();
          applySuggestion(suggestion);
          applied.add(index);
          render();
        },
      );
      use.disabled = applied.has(index);
      row.append(use);
      section.append(row);
    });
    return section;
  }

  function shareSection(): HTMLElement {
    const section = node("section", "profile-share");
    section.append(
      node("h3", "profile-section-title", text.share),
      node("p", "profile-muted", text.shareHint),
    );
    if (!applications.length) {
      section.append(node("p", "profile-muted", text.noApplications));
      return section;
    }
    const form = node("form", "profile-share-form");
    const resumeChoice = select(
      text.chooseResume,
      resumes.map((resume) => ({ value: resume.id, label: resume.filename })),
      selectedResume,
      (value) => {
        selectedResume = value;
      },
    );
    const applicationChoice = select(
      text.chooseApplication,
      applications.map((application) => ({
        value: application.id,
        label: application.postingTitle,
      })),
      selectedApplication,
      (value) => {
        selectedApplication = value;
      },
    );
    const submit = action(
      text.shareButton,
      "profile-button profile-button-primary",
    );
    submit.type = "submit";
    submit.disabled = !!pending || !resumes.length;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void shareResume();
    });
    form.append(resumeChoice, applicationChoice, submit);
    section.append(form);
    return section;
  }

  function applySuggestion(
    suggestion: ResumeExtractionResponse["extraction"]["suggestions"][number],
  ): void {
    const value = Array.isArray(suggestion.value)
      ? suggestion.value.join(", ")
      : suggestion.value;
    if (suggestion.field === "skills") {
      draft.skills = Array.from(
        new Set([
          ...draft.skills,
          ...value
            .split(/[,\n]/)
            .map((part) => part.trim())
            .filter(Boolean),
        ]),
      );
    } else if (suggestion.field === "education") {
      draft.education.push({
        institution: "",
        credential: "",
        fieldOfStudy: "",
        startDate: "",
        endDate: "",
        description: value,
      });
    } else if (suggestion.field === "experience") {
      draft.experience.push({
        organization: "",
        title: "",
        startDate: "",
        endDate: "",
        description: value,
      });
    } else {
      draft[suggestion.field] = value;
    }
  }

  async function initialize(): Promise<void> {
    if (!token) {
      render();
      return;
    }
    try {
      const [profile, assets, applicationsResult] = await Promise.all([
        request<{ profile: ApplicantProfileView | null }>("/profile", token),
        request<{ resumes: ResumeView[] }>("/profile/resumes", token),
        request<{ applications: ApplicationChoice[] }>("/applications", token),
      ]);
      draft = profile.profile ?? empty();
      resumes = assets.resumes;
      applications = applicationsResult.applications;
      selectedResume = resumes[0]?.id ?? "";
      selectedApplication = applications[0]?.id ?? "";
    } catch (cause) {
      error = message(cause);
    } finally {
      loading = false;
      render();
    }
  }

  async function saveProfile(): Promise<void> {
    if (!token) return;
    captureDraft();
    pending = "save";
    error = "";
    notice = "";
    render();
    try {
      const result = await request<{ profile: ApplicantProfileView }>(
        "/profile",
        token,
        "PUT",
        { profile: draft },
      );
      draft = result.profile;
      notice = text.saved;
    } catch (cause) {
      error = message(cause);
    } finally {
      pending = "";
      render();
    }
  }

  async function uploadResume(): Promise<void> {
    if (!token || !file) return;
    captureDraft();
    pending = "upload";
    error = "";
    notice = "";
    render();
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await request<{ resume: ResumeView }>(
        "/profile/resumes",
        token,
        "POST",
        data,
      );
      resumes.unshift(result.resume);
      selectedResume = result.resume.id;
      file = null;
    } catch (cause) {
      error = message(cause);
    } finally {
      pending = "";
      render();
    }
  }

  async function extract(id: string): Promise<void> {
    if (!token) return;
    captureDraft();
    error = "";
    notice = "";
    try {
      const result = await request<ResumeExtractionResponse>(
        `/profile/resumes/${encodeURIComponent(id)}/extract`,
        token,
        "POST",
      );
      extraction = result.extraction;
      applied = new Set();
      render();
      root
        .querySelector(".profile-extraction")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) {
      error = message(cause);
      render();
    }
  }

  async function removeResume(id: string): Promise<void> {
    if (!token || !window.confirm(text.confirmDelete)) return;
    captureDraft();
    try {
      await request(
        `/profile/resumes/${encodeURIComponent(id)}`,
        token,
        "DELETE",
      );
      resumes = resumes.filter((resume) => resume.id !== id);
      if (selectedResume === id) selectedResume = resumes[0]?.id ?? "";
      if (extraction?.resumeId === id) extraction = null;
      notice = text.deleted;
      render();
    } catch (cause) {
      error = message(cause);
      render();
    }
  }

  async function shareResume(): Promise<void> {
    if (!token || !selectedResume || !selectedApplication) return;
    captureDraft();
    pending = "share";
    error = "";
    notice = "";
    try {
      await request(
        `/applications/${encodeURIComponent(selectedApplication)}/resume`,
        token,
        "PUT",
        { resumeId: selectedResume },
      );
      notice = text.shared;
    } catch (cause) {
      error = message(cause);
    } finally {
      pending = "";
      render();
    }
  }

  void initialize();
  return root;
}

function fieldInput(
  label: string,
  name: string,
  value: string,
  type = "text",
): HTMLElement {
  const field = node("label", "profile-field");
  field.append(node("span", "", label));
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.value = value;
  field.append(input);
  return field;
}

function fieldArea(label: string, name: string, value: string): HTMLElement {
  const field = node("label", "profile-field");
  field.append(node("span", "", label));
  const input = document.createElement("textarea");
  input.name = name;
  input.rows = name === "summary" ? 4 : 3;
  input.value = value;
  field.append(input);
  return field;
}

function select(
  label: string,
  choices: Array<{ value: string; label: string }>,
  current: string,
  onChange: (value: string) => void,
): HTMLElement {
  const field = node("label", "profile-field");
  field.append(node("span", "", label));
  const input = document.createElement("select");
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    option.selected = choice.value === current;
    input.append(option);
  }
  input.addEventListener("change", () => onChange(input.value));
  field.append(input);
  return field;
}

async function request<T>(
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body === undefined || multipart
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(body === undefined
      ? {}
      : { body: multipart ? body : JSON.stringify(body) }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok)
    throw new Error(
      payload?.error?.message ?? `Request failed (${response.status})`,
    );
  if (!payload) throw new Error("Invalid response");
  return payload;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function action(
  label: string,
  className: string,
  handler?: () => void,
): HTMLButtonElement {
  const button = node("button", className, label);
  button.type = "button";
  if (handler) button.addEventListener("click", handler);
  return button;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
