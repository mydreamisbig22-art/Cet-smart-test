# CET SMART TEST — AI MCQ Practice Platform

## What this project includes
- PDF text extraction in the browser; scanned PDF pages use OCR when no selectable text is found.
- Image OCR for JPG/PNG and multiple uploads.
- Paste-text input.
- AI MCQ generation through a server-side OpenAI-compatible API call.
- Four-option questions, instant green/red feedback, explanations, answer review and wrong-answer retests.
- Local browser test history.
- Responsive mobile-first UI.

## Requirements
- Node.js 20 or newer
- An API key for an OpenAI-compatible chat-completions provider
- Internet access for installing packages and calling the AI provider

## Run locally
1. Extract this ZIP.
2. Open a terminal in the project folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Put your API key in `.env` as `OPENAI_API_KEY=...`.
6. Run `npm run dev`.
7. Open the local URL printed by Vite (usually http://localhost:5173).

For a production build:
- Run `npm run build`
- Run `npm start`
- The Express server serves the built website and the `/api` endpoint.

## Deploy online
This project is suitable for a Node hosting service such as Render:
1. Create a new Web Service from this project repository.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add environment variables `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
5. Deploy. Do not put the API key in frontend code or commit `.env`.

A Git repository is needed for the standard Render Git deployment flow. A similar Node host can be used.

## Important accuracy and privacy notes
- AI-generated questions can still contain mistakes. The app asks the model to use only source text, validates the four-option structure, and shows a source quote, but a human should verify important facts against the book.
- The app currently stores test history in the browser's localStorage. It does not have user accounts or cloud sync.
- Uploaded material is sent to your configured AI provider as extracted text when you generate questions. Do not upload private or sensitive documents.
- Very large books are chunked, but the current version processes at most 12 text chunks per generation request. For a 204-page book, generate tests chapter-by-chapter or in smaller batches for better coverage and fewer missed details.
- OCR accuracy depends on image quality, print clarity and language recognition support. Review extracted text before generating.
- API usage may incur charges. Ask a parent/guardian to help review provider terms and billing before enabling a paid API key.
