export class HeadyGateway {
    /**
     * @param {Object} options
     * @param {string} options.baseUrl - HeadyStack API base URL
     * @param {string} [options.apiKey] - API key (X-Heady™-Key header)
     * @param {string} [options.accessToken] - Bearer access token
     * @param {number} [options.timeout] - Request timeout in ms (default: 30000)
     * @param {boolean} [options.debug] - Enable debug logging
     */
    constructor({ baseUrl, apiKey, accessToken, timeout, debug }?: {
        baseUrl: string;
        apiKey?: string | undefined;
        accessToken?: string | undefined;
        timeout?: number | undefined;
        debug?: boolean | undefined;
    });
    _baseUrl: string;
    _apiKey: string | undefined;
    _accessToken: string | undefined;
    _timeout: number;
    _debug: boolean;
    auth: {
        register: (data: any) => Promise<any>;
        login: (credentials: any) => Promise<any>;
        logout: (data: any) => Promise<any>;
        refresh: (refreshToken: any) => Promise<any>;
    };
    chat: {
        /**
         * Send a chat message.
         * @param {Object} opts
         * @param {string} opts.message
         * @param {string} [opts.model]
         * @param {boolean} [opts.stream]
         * @returns {Promise<Object>}
         */
        send: ({ message, model, systemPrompt, history, temperature, maxTokens, namespace, stream }?: {
            message: string;
            model?: string | undefined;
            stream?: boolean | undefined;
        }) => Promise<Object>;
    };
    agents: {
        spawn: (opts: any) => Promise<any>;
        list: () => Promise<any>;
        get: (agentId: any) => Promise<any>;
        terminate: (agentId: any) => Promise<any>;
        stream: (agentId: any) => Promise<any>;
    };
    bees: {
        /**
         * Invoke a bee domain agent.
         * @param {string} domain - bee domain ID
         * @param {Object} opts - { task, context, engine, stream }
         */
        invoke: (domain: string, opts: Object) => Promise<any>;
        list: () => Promise<any>;
    };
    memory: {
        store: ({ namespace, key, content, metadata }?: {}) => Promise<any>;
        search: ({ query, namespace, topK, minScore }?: {}) => Promise<any>;
        get: (id: any) => Promise<any>;
        delete: (id: any) => Promise<any>;
    };
    pipeline: {
        enqueue: ({ type, data, priority }?: {
            priority?: string | undefined;
        }) => Promise<any>;
        status: (taskId: any) => Promise<any>;
        list: ({ status, limit }?: {}) => Promise<any>;
    };
    files: {
        upload: ({ filename, content, mimeType, namespace }?: {
            namespace?: string | undefined;
        }) => Promise<any>;
        search: ({ query, namespace, topK }?: {}) => Promise<any>;
        get: (fileId: any) => Promise<any>;
        delete: (fileId: any) => Promise<any>;
    };
    notion: {
        createPage: ({ parentId, title, content, properties }?: {}) => Promise<any>;
        getPage: (pageId: any) => Promise<any>;
        queryDatabase: (databaseId: any, { filter, sorts, pageSize }?: {}) => Promise<any>;
    };
    github: {
        getRepo: (owner: any, repo: any) => Promise<any>;
        getFile: (owner: any, repo: any, path: any, ref?: string) => Promise<any>;
        createIssue: (owner: any, repo: any, data: any) => Promise<any>;
        createPR: (owner: any, repo: any, data: any) => Promise<any>;
    };
    stripe: {
        createCustomer: (data: any) => Promise<any>;
        listSubscriptions: ({ customerId, status, limit }?: {}) => Promise<any>;
    };
    cloudflare: {
        listDns: ({ type, name }?: {}) => Promise<any>;
        createDns: (data: any) => Promise<any>;
        deleteDns: (id: any) => Promise<any>;
        purgeCache: ({ purgeEverything, files }?: {
            purgeEverything?: boolean | undefined;
        }) => Promise<any>;
    };
    render: {
        listServices: () => Promise<any>;
        deploy: (serviceId: any, { clearCache }?: {
            clearCache?: boolean | undefined;
        }) => Promise<any>;
    };
    mcp: {
        info: () => Promise<any>;
        listTools: () => Promise<any>;
        callTool: (name: any, args: any) => Promise<any>;
    };
    system: {
        health: () => Promise<any>;
        ready: () => Promise<any>;
        pulse: () => Promise<any>;
        metrics: () => Promise<any>;
        version: () => Promise<any>;
    };
    _request(method: any, path: any, { body, query, headers, stream }?: {
        headers?: {} | undefined;
        stream?: boolean | undefined;
    }): Promise<any>;
    _get(path: any, opts: any): Promise<any>;
    _post(path: any, body: any, opts: any): Promise<any>;
    _put(path: any, body: any, opts: any): Promise<any>;
    _delete(path: any, opts: any): Promise<any>;
    /**
     * Update the access token (e.g., after token refresh)
     * @param {string} token
     */
    setAccessToken(token: string): void;
    _buildAuthDomain(): {
        register: (data: any) => Promise<any>;
        login: (credentials: any) => Promise<any>;
        logout: (data: any) => Promise<any>;
        refresh: (refreshToken: any) => Promise<any>;
    };
    _buildChatDomain(): {
        /**
         * Send a chat message.
         * @param {Object} opts
         * @param {string} opts.message
         * @param {string} [opts.model]
         * @param {boolean} [opts.stream]
         * @returns {Promise<Object>}
         */
        send: ({ message, model, systemPrompt, history, temperature, maxTokens, namespace, stream }?: {
            message: string;
            model?: string | undefined;
            stream?: boolean | undefined;
        }) => Promise<Object>;
    };
    _buildAgentsDomain(): {
        spawn: (opts: any) => Promise<any>;
        list: () => Promise<any>;
        get: (agentId: any) => Promise<any>;
        terminate: (agentId: any) => Promise<any>;
        stream: (agentId: any) => Promise<any>;
    };
    _buildBeesDomain(): {
        /**
         * Invoke a bee domain agent.
         * @param {string} domain - bee domain ID
         * @param {Object} opts - { task, context, engine, stream }
         */
        invoke: (domain: string, opts: Object) => Promise<any>;
        list: () => Promise<any>;
    };
    _buildMemoryDomain(): {
        store: ({ namespace, key, content, metadata }?: {}) => Promise<any>;
        search: ({ query, namespace, topK, minScore }?: {}) => Promise<any>;
        get: (id: any) => Promise<any>;
        delete: (id: any) => Promise<any>;
    };
    _buildPipelineDomain(): {
        enqueue: ({ type, data, priority }?: {
            priority?: string | undefined;
        }) => Promise<any>;
        status: (taskId: any) => Promise<any>;
        list: ({ status, limit }?: {}) => Promise<any>;
    };
    _buildFilesDomain(): {
        upload: ({ filename, content, mimeType, namespace }?: {
            namespace?: string | undefined;
        }) => Promise<any>;
        search: ({ query, namespace, topK }?: {}) => Promise<any>;
        get: (fileId: any) => Promise<any>;
        delete: (fileId: any) => Promise<any>;
    };
    _buildNotionDomain(): {
        createPage: ({ parentId, title, content, properties }?: {}) => Promise<any>;
        getPage: (pageId: any) => Promise<any>;
        queryDatabase: (databaseId: any, { filter, sorts, pageSize }?: {}) => Promise<any>;
    };
    _buildGithubDomain(): {
        getRepo: (owner: any, repo: any) => Promise<any>;
        getFile: (owner: any, repo: any, path: any, ref?: string) => Promise<any>;
        createIssue: (owner: any, repo: any, data: any) => Promise<any>;
        createPR: (owner: any, repo: any, data: any) => Promise<any>;
    };
    _buildStripeDomain(): {
        createCustomer: (data: any) => Promise<any>;
        listSubscriptions: ({ customerId, status, limit }?: {}) => Promise<any>;
    };
    _buildCloudflareDomain(): {
        listDns: ({ type, name }?: {}) => Promise<any>;
        createDns: (data: any) => Promise<any>;
        deleteDns: (id: any) => Promise<any>;
        purgeCache: ({ purgeEverything, files }?: {
            purgeEverything?: boolean | undefined;
        }) => Promise<any>;
    };
    _buildRenderDomain(): {
        listServices: () => Promise<any>;
        deploy: (serviceId: any, { clearCache }?: {
            clearCache?: boolean | undefined;
        }) => Promise<any>;
    };
    _buildMcpDomain(): {
        info: () => Promise<any>;
        listTools: () => Promise<any>;
        callTool: (name: any, args: any) => Promise<any>;
    };
    _buildSystemDomain(): {
        health: () => Promise<any>;
        ready: () => Promise<any>;
        pulse: () => Promise<any>;
        metrics: () => Promise<any>;
        version: () => Promise<any>;
    };
}
//# sourceMappingURL=gateway.d.ts.map