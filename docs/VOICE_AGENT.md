# ElevenLabs voice intake setup

The Worker accepts signed ElevenLabs `post_call_transcription` events at `POST /api/integrations/elevenlabs/webhook`. Set `ELEVENLABS_WEBHOOK_SECRET` and `ELEVENLABS_AGENT_ID` as Worker secrets. The endpoint verifies the `ElevenLabs-Signature` HMAC over the timestamp and raw body, rejects signatures older than 30 minutes, checks the agent ID, and uses `conversation_id` to prevent duplicate cases.

Configure these **Data Collection** identifiers in the ElevenLabs agent's Analysis tab:

| Identifier          | Type    | Instruction                                                                                       |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `issue_description` | String  | Concise factual description of the resident's issue, including the answer to follow-up questions. |
| `location`          | String  | Street address or landmark for the issue. Leave empty if the resident did not provide one.        |
| `confirmed`         | Boolean | True only if the resident explicitly confirmed the agent's readback of the issue and location.    |

Agent prompt for the first golden path:

> You help residents report civic issues. Ask for a description and location. Ask only the follow-up questions needed to understand the issue. For a dangerous sidewalk, ask what makes it dangerous and whether anyone is injured now. Read back the report, ask for explicit confirmation, and say that staff will review it. Do not say that the issue is resolved or promise an emergency response. If the resident reports an immediate emergency, direct them to local emergency services.

Test conversation:

1. Resident: “The sidewalk near the library is dangerous.”
2. Agent: “What makes it dangerous?”
3. Resident: “A large section is lifted and someone could trip.”
4. Agent: “Is anyone injured right now?”
5. Resident: “No.”
6. Agent reads back a report located near the library and asks for confirmation.
7. Resident confirms.

The post-call webhook creates a case only when all three collected fields are valid. It returns `incomplete` without creating a case otherwise. The transcript is retained in `voice_sessions` and exposed only through the protected admin case detail API. The signed local path is testable without an ElevenLabs account, but a live proof point requires configuring an actual agent, webhook, and public Worker deployment.
