// A fixed id, so the demo workspace is the same one every time instead of a new one per click.
// The frontend never needs this value: it only remembers "the workspace I was on before demo" and
// asks the server for "the demo workspace", by name, through the routes below.
export const demoWorkspaceId = '11111111-1111-4111-8111-111111111111'

export const demoFiles = ['01-brief.txt', '02-tasks.txt', '03-meetings.txt']
