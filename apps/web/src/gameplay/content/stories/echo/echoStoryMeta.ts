// Echo story metadata — the id constant shared by the story definition, the
// task-guide wiring, and (documented in) the server catalog. Deliberately
// free of story text AND of asset imports so it stays tiny: this module is
// the only piece of the echo story that ships in the main bundle while the
// story is suspended (a ~60 B module beats a three-way hand-copied literal —
// apps/server/src/storyCatalog.ts mirrors the id as 'main.echo.act-one' and
// carries a comment pointing here; the server compiles separately and cannot
// import from apps/web).
export const ECHO_STORY_ID = 'main.echo.act-one';
