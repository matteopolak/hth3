import Foundation

enum AppCopy {
    static func status(_ status: String, locale: AppLocale) -> String {
        let values: [String: String] = locale == .en ? [
            "submitted": "Submitted", "acknowledged": "Acknowledged", "in_review": "In review",
            "waiting_on_resident": "Waiting on you", "outcome_recorded": "Outcome recorded", "closed": "Closed", "reopened": "Reopened",
            "under_review": "Under review", "information_requested": "Information requested", "shortlisted": "Shortlisted", "declined": "Declined", "offer": "Offer",
        ] : [
            "submitted": "Envoyée", "acknowledged": "Accusé de réception", "in_review": "À l’étude",
            "waiting_on_resident": "En attente de votre réponse", "outcome_recorded": "Résultat consigné", "closed": "Fermée", "reopened": "Rouverte",
            "under_review": "À l’étude", "information_requested": "Renseignements demandés", "shortlisted": "Présélectionnée", "declined": "Refusée", "offer": "Offre",
        ]
        return values[status] ?? status
    }

    static func value(_ key: String, locale: AppLocale) -> String {
        let english: [String: String] = [
            "app.name": "CivicResolve", "app.language": "Choose language",
            "nav.feedback": "Feedback", "nav.applications": "Applications",
            "sandbox.title": "Fictional Toronto sandbox", "sandbox.body": "This demo is unaffiliated with the City of Toronto or any government. Nothing here is sent to a public authority.",
            "feedback.title": "Tell us what happened", "feedback.intro": "Share a public-service concern. Review your words before they go to the fictional sample queue.",
            "feedback.message": "What happened?", "feedback.messageHint": "Describe the issue in your own words.",
            "feedback.improvement": "What would help? (optional)", "feedback.improvementHint": "A change that could improve the service.",
            "feedback.review": "Review message", "feedback.reviewTitle": "Review before sending", "feedback.original": "Your original message",
            "feedback.ack": "I understand this goes only to CivicResolve’s fictional Toronto sandbox, not to the City or an emergency service.",
            "feedback.send": "Send to sample queue", "feedback.edit": "Edit", "feedback.sent": "Your message was saved to the fictional sample queue.",
            "feedback.replySent": "Your follow-up was sent to the sample queue.", "feedback.keychainFailed": "Your message was saved. This device could not securely retain the private receipt token, so keep the receipt open to check updates.",
            "feedback.emergency": "If anyone is in immediate danger, call 911. This demo is not monitored for emergencies.",
            "feedback.noReceipt": "No feedback receipt is saved on this device.", "feedback.receipt": "Private receipt", "feedback.refresh": "Refresh status", "feedback.reply": "Add a follow-up", "feedback.replyHint": "Add information for the sample queue.", "feedback.replySend": "Send follow-up", "feedback.status": "Status",
            "application.title": "Explore a sample opportunity", "application.signIn": "Sign in only when you are ready to submit.",
            "application.noPostings": "No sample postings are available right now.", "application.noApplications": "No applications on this account yet.",
            "application.experience": "Relevant experience", "application.experienceHint": "Describe your experience.", "application.availability": "Availability", "application.availabilityHint": "When could you start?",
            "application.confirm": "I reviewed these answers and want to submit this sample application.", "application.submit": "Submit sample application", "application.sent": "Your application was saved to the sample employer queue.", "application.sampleEmployer": "Fictional sample employer", "application.sampleLocation": "Toronto geography · fictional organization",
            "auth.signInRequired": "Sign in at this step to continue.", "local.identityLabel": "Local test identity", "local.identityNotice": "Development identity only. These fixed test credentials are accepted only by a local Worker.",
            "common.retry": "Try again", "common.refresh": "Refresh", "common.loading": "Loading…", "error.generic": "The request could not be completed.", "error.network": "The service could not be reached. Check your connection and try again.", "error.requiredFields": "Complete the required fields before continuing.", "error.forbidden": "This account does not have permission for that action.", "error.unsupportedDestination": "This destination is not supported. Nothing was sent elsewhere.", "feedback.ackRequired": "Confirm that the sandbox is fictional before sending.",
        ]
        let french: [String: String] = [
            "app.name": "CivicResolve", "app.language": "Choisir la langue",
            "nav.feedback": "Commentaires", "nav.applications": "Candidatures",
            "sandbox.title": "Bac à sable fictif de Toronto", "sandbox.body": "Cette démo n’est affiliée ni à la Ville de Toronto ni à un gouvernement. Rien n’est transmis à une autorité publique.",
            "feedback.title": "Racontez-nous ce qui s’est passé", "feedback.intro": "Décrivez un problème de service public. Vérifiez votre texte avant de l’envoyer à la boîte fictive.",
            "feedback.message": "Que s’est-il passé ?", "feedback.messageHint": "Décrivez le problème avec vos propres mots.",
            "feedback.improvement": "Qu’est-ce qui aiderait ? (facultatif)", "feedback.improvementHint": "Un changement qui pourrait améliorer le service.",
            "feedback.review": "Vérifier le message", "feedback.reviewTitle": "Vérifiez avant l’envoi", "feedback.original": "Votre message original",
            "feedback.ack": "Je comprends que ce message va uniquement à la boîte fictive de CivicResolve à Toronto, et non à la Ville ou à un service d’urgence.",
            "feedback.send": "Envoyer à la boîte fictive", "feedback.edit": "Modifier", "feedback.sent": "Votre message a été enregistré dans la boîte fictive.",
            "feedback.replySent": "Votre suivi a été envoyé à la boîte fictive.", "feedback.keychainFailed": "Votre message a été enregistré. Cet appareil n’a pas pu conserver le jeton privé de façon sécurisée; gardez le reçu ouvert pour consulter les mises à jour.",
            "feedback.emergency": "Si quelqu’un est en danger immédiat, appelez le 911. Cette démo ne surveille pas les urgences.",
            "feedback.noReceipt": "Aucun reçu de commentaire n’est enregistré sur cet appareil.", "feedback.receipt": "Reçu privé", "feedback.refresh": "Actualiser l’état", "feedback.reply": "Ajouter un suivi", "feedback.replyHint": "Ajoutez de l’information pour la boîte fictive.", "feedback.replySend": "Envoyer le suivi", "feedback.status": "État",
            "application.title": "Découvrir une possibilité fictive", "application.signIn": "Connectez-vous seulement lorsque vous êtes prêt à envoyer.",
            "application.noPostings": "Aucune offre fictive n’est disponible pour le moment.", "application.noApplications": "Aucune candidature sur ce compte pour le moment.",
            "application.experience": "Expérience pertinente", "application.experienceHint": "Décrivez votre expérience.", "application.availability": "Disponibilité", "application.availabilityHint": "Quand pourriez-vous commencer ?",
            "application.confirm": "J’ai vérifié ces réponses et je souhaite envoyer cette candidature fictive.", "application.submit": "Envoyer la candidature fictive", "application.sent": "Votre candidature a été enregistrée dans la file de l’employeur fictif.", "application.sampleEmployer": "Employeur fictif", "application.sampleLocation": "Géographie de Toronto · organisation fictive",
            "auth.signInRequired": "Connectez-vous à cette étape pour continuer.", "local.identityLabel": "Identité de test locale", "local.identityNotice": "Identité de développement seulement. Ces justificatifs fixes fonctionnent uniquement avec un Worker local.",
            "common.retry": "Réessayer", "common.refresh": "Actualiser", "common.loading": "Chargement…", "error.generic": "La demande n’a pas pu être traitée.", "error.network": "Le service est inaccessible. Vérifiez votre connexion et réessayez.", "error.requiredFields": "Remplissez les champs obligatoires avant de continuer.", "error.forbidden": "Ce compte n’a pas l’autorisation requise.", "error.unsupportedDestination": "Cette destination n’est pas prise en charge. Rien n’a été transmis ailleurs.",
            "feedback.ackRequired": "Confirmez que le bac à sable est fictif avant l’envoi.",
        ]
        let selected = locale == .en ? english : french
        return selected[key] ?? english[key] ?? key
    }
}
