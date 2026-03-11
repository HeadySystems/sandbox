const fs = require('fs');
const path = require('path');
const { CODEBASE_ROOT } = require('./config');

function ensureInsideCodebase(relativePath) {
    const safeRelativePath = String(relativePath || '').trim();
    const absolutePath = path.resolve(CODEBASE_ROOT, safeRelativePath);
    if (!absolutePath.startsWith(CODEBASE_ROOT)) {
        throw new Error('PATH_OUTSIDE_CODEBASE');
    }
    return { absolutePath, safeRelativePath };
}

function parseCommand(message) {
    const value = String(message || '').trim();

    if (value.startsWith('/list ')) {
        return { tool: 'list', argument: value.slice('/list '.length).trim() || '.' };
    }
    if (value.startsWith('/read ')) {
        return { tool: 'read', argument: value.slice('/read '.length).trim() };
    }
    if (value.startsWith('/write ')) {
        const [firstLine, ...rest] = value.split('\n');
        return { tool: 'write', argument: firstLine.slice('/write '.length).trim(), content: rest.join('\n') };
    }
    if (value.startsWith('/append ')) {
        const [firstLine, ...rest] = value.split('\n');
        return { tool: 'append', argument: firstLine.slice('/append '.length).trim(), content: rest.join('\n') };
    }

    return { tool: 'assist', argument: value };
}

class IdeChatService {
    execute(message) {
        const command = parseCommand(message);

        if (command.tool === 'assist') {
            return {
                role: 'assistant',
                output: 'Use one of: /list <dir>, /read <file>, /write <file>\\n<content>, /append <file>\\n<content>.',
            };
        }

        if (command.tool === 'list') {
            const { absolutePath, safeRelativePath } = ensureInsideCodebase(command.argument);
            const entries = fs.readdirSync(absolutePath, { withFileTypes: true }).slice(0, 200).map((entry) => ({
                name: entry.name,
                type: entry.isDirectory() ? 'dir' : 'file',
            }));
            return {
                role: 'assistant',
                output: `Listed ${entries.length} entries in ${safeRelativePath}`,
                data: entries,
            };
        }

        if (command.tool === 'read') {
            const { absolutePath, safeRelativePath } = ensureInsideCodebase(command.argument);
            const content = fs.readFileSync(absolutePath, 'utf8');
            return {
                role: 'assistant',
                output: `Read file ${safeRelativePath}`,
                data: { content },
            };
        }

        if (command.tool === 'write') {
            const { absolutePath, safeRelativePath } = ensureInsideCodebase(command.argument);
            fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
            fs.writeFileSync(absolutePath, command.content || '', 'utf8');
            return {
                role: 'assistant',
                output: `Wrote file ${safeRelativePath}`,
            };
        }

        if (command.tool === 'append') {
            const { absolutePath, safeRelativePath } = ensureInsideCodebase(command.argument);
            fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
            fs.appendFileSync(absolutePath, command.content || '', 'utf8');
            return {
                role: 'assistant',
                output: `Appended file ${safeRelativePath}`,
            };
        }

        throw new Error('UNKNOWN_TOOL');
    }
}

module.exports = {
    IdeChatService,
};
