/** What members are told about messages. Keep it true: messages are NOT end-to-end encrypted. */
export const PRIVACY_NOTE =
  "Messages are private to the people in the conversation and are protected in transit and in storage. They are not end-to-end encrypted, so Medyra systems and staff with database access could technically read them. Medyra staff look at a message only if someone reports it.";

export const SAFETY_NOTE =
  "Don't share identifiable patient or client information in messages. If someone is in immediate danger, contact your local emergency number: Medyra is not a crisis service.";

export const REQUEST_NOTE =
  "You haven't connected with this person. You can read their message without them knowing, and nothing is sent back until you accept. Declining is private: they aren't told.";

export const PENDING_NOTE =
  "This person hasn't accepted your message request yet. You can send up to two messages until they do. If they decline, you won't be told.";

export const MESSAGE_MAX = 4000;
export const GROUP_MAX = 20;
export const MESSAGES_PAGE = 100;
export const LIST_LIMIT = 100;
