import type en from "./en.js";

type Catalogue = { [Key in keyof typeof en]: string };

const fr: Catalogue = {
  "app.name": "CivicResolve",
  "app.language": "Langue",
  "language.english": "Anglais",
  "language.french": "Français",
  "common.loading": "Chargement…",
  "common.retry": "Réessayer",
  "common.cancel": "Annuler",
  "common.submit": "Envoyer",
  "common.error": "La demande n’a pas pu être effectuée.",
  "common.connectionError":
    "Le service est inaccessible. Vérifiez votre connexion et réessayez.",
  "auth.signInRequired": "Connectez-vous pour continuer.",
  "auth.forbidden":
    "Vous n’avez pas l’autorisation de consulter ces renseignements.",
  "feedback.title": "Donner votre avis",
  "feedback.intro":
    "Expliquez à l’équipe ce qui s’est passé et comment améliorer le service.",
  "feedback.messageLabel": "Que s’est-il passé?",
  "feedback.messagePlaceholder": "Décrivez votre expérience",
  "feedback.privacyNotice":
    "Décrivez uniquement les faits nécessaires pour comprendre votre expérience. N’incluez ni numéro d’assurance sociale, ni mot de passe, ni renseignement bancaire. L’équipe fictive de CivicResolve peut lire ce message et les renseignements que vous fournissez afin de répondre à votre suivi; ce prototype ne transmet rien à une municipalité ni à un organisme gouvernemental. Conservez le lien de reçu privé dans un endroit sûr : toute personne qui le possède peut consulter les mises à jour de cet envoi.",
  "feedback.submitted":
    "Votre avis a été enregistré. Gardez le reçu {receiptId} pour consulter les mises à jour.",
  "feedback.receiptTitle": "Reçu de votre avis",
  "feedback.receiptStatus": "État",
  "feedback.receiptNotFound": "Impossible de vérifier ce reçu.",
  "feedback.staffReplyLabel": "Réponse de l’équipe",
  "application.title": "Postuler auprès d’un employeur participant",
  "application.sampleNotice":
    "Cette offre fictive sert aux essais. Votre candidature reste dans cet espace de démonstration et n’est transmise à aucun organisme gouvernemental.",
  "application.confirmReview":
    "J’ai vérifié mes réponses et je confirme vouloir envoyer cette candidature.",
  "application.confirmRequired":
    "Vérifiez et confirmez vos réponses avant l’envoi.",
  "application.submitted": "Votre candidature a été envoyée à {organization}.",
  "application.employerQueue": "Candidatures de l’employeur",
  "application.changeStatus": "Mettre à jour l’état de la candidature",
  "application.loadError": "Impossible de charger cette offre.",
};

export default fr;
