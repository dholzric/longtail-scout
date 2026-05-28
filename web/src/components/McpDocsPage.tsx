/**
 * Public docs at /mcp — how to plug LongTail Scout into any MCP-aware client.
 * Includes Claude Desktop config + curl examples for tool discovery and tool calls.
 */
export function McpDocsPage() {
  return (
    <div class="min-h-screen bg-paper text-ink">
      <header class="border-b border-ink-15">
        <div class="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between gap-4">
          <div>
            <div class="font-mono text-[10px] uppercase tracking-[0.16em] text-rust mb-1">§ MCP</div>
            <h1 class="font-serif text-3xl font-bold tracking-tight">LongTail Scout · MCP server</h1>
            <p class="text-sm text-ink-70 mt-1.5">Use any MCP-aware client to drive scouts directly — Claude Desktop, Cursor, ChatGPT MCP, your own agent.</p>
          </div>
          <a class="text-sm text-rust underline" href="/">← back to demo</a>
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-6 py-10 space-y-10">

        <section>
          <h2 class="font-serif text-xl font-semibold mb-2">Endpoint</h2>
          <pre class="rounded bg-ink-deep text-paper p-4 font-mono text-xs overflow-auto">https://longtailscout.com/api/mcp</pre>
          <p class="mt-2 text-sm text-ink-70">JSON-RPC 2.0 over HTTP. Auth: <code class="bg-paper-3 px-1.5 py-0.5 font-mono text-xs">Authorization: Bearer &lt;DEMO_PASSWORD&gt;</code> (password is in the lablab.ai submission description).</p>
        </section>

        <section>
          <h2 class="font-serif text-xl font-semibold mb-2">Tools exposed</h2>
          <ul class="space-y-3">
            <ToolRow name="scout" desc="Run a long-tail scout for a niche × city. Returns ranked operators with citations. `mode: 'sample'` (default) is cached + free; `mode: 'live'` burns real BD + LLM credits." />
            <ToolRow name="find_businesses" desc="Geotagged business records from our 7M-record demand index for a niche + city. lat/lng + rating + address + website per hit." />
            <ToolRow name="demand_count" desc="Single integer — how many businesses match this niche in the index, nationally. Faster than find_businesses." />
            <ToolRow name="operator_screenshot" desc="Capture a live homepage screenshot via Bright Data Browser API. Returns base64 PNG. Cached 30 days." />
            <ToolRow name="draft_email" desc="AI-personalized cold email for one operator. References their about + hiring + recent activity. ~$0.0002/call." />
            <ToolRow name="niche_recon" desc="Reverse the GTM funnel — paste a product description, get the top 5 long-tail verticals ranked by demand-density × Apollo-thinness. The killer demo move." />
          </ul>
        </section>

        <section>
          <h2 class="font-serif text-xl font-semibold mb-2">Claude Desktop config</h2>
          <p class="text-sm text-ink-70 mb-3">Edit <code class="bg-paper-3 px-1.5 py-0.5 font-mono text-xs">claude_desktop_config.json</code> and add a server block:</p>
          <pre class="rounded bg-ink-deep text-paper p-4 font-mono text-xs overflow-auto whitespace-pre">{`{
  "mcpServers": {
    "longtailscout": {
      "url": "https://longtailscout.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <DEMO_PASSWORD>"
      }
    }
  }
}`}</pre>
          <p class="text-sm text-ink-60 mt-2">Restart Claude Desktop. The five tools appear under the 🔌 plug menu. Try: <em>"Use longtailscout to find roofing contractors in Houston."</em></p>
        </section>

        <section>
          <h2 class="font-serif text-xl font-semibold mb-2">Try it with curl</h2>
          <div class="grid gap-3">
            <CurlBlock
              title="List available tools"
              cmd={`curl https://longtailscout.com/api/mcp \\
  -X POST \\
  -H "authorization: Bearer <DEMO_PASSWORD>" \\
  -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
            />
            <CurlBlock
              title="Run a sample scout (free, cached)"
              cmd={`curl https://longtailscout.com/api/mcp \\
  -X POST \\
  -H "authorization: Bearer <DEMO_PASSWORD>" \\
  -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"scout","arguments":{"query":"roofing contractors in Houston"}}}'`}
            />
            <CurlBlock
              title="Find businesses (demand-index lookup)"
              cmd={`curl https://longtailscout.com/api/mcp \\
  -X POST \\
  -H "authorization: Bearer <DEMO_PASSWORD>" \\
  -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"find_businesses","arguments":{"niche":"roofing","city":"Houston","limit":10}}}'`}
            />
            <CurlBlock
              title="Demand count for a niche"
              cmd={`curl https://longtailscout.com/api/mcp \\
  -X POST \\
  -H "authorization: Bearer <DEMO_PASSWORD>" \\
  -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"demand_count","arguments":{"niche":"law"}}}'`}
            />
          </div>
        </section>

        <section>
          <h2 class="font-serif text-xl font-semibold mb-2">Why this matters</h2>
          <p class="text-sm text-ink-70 leading-relaxed">
            Most prospect-data products are walled gardens — you log in, click around, export a CSV. LongTail Scout is an <em>agent endpoint</em>: any MCP client can ask it for operators in natural language, get them back as structured data, and chain it into outreach workflows. The same tools the LongTail Scout UI uses, exposed to whatever assistant you already use.
          </p>
        </section>

        <section class="text-xs text-ink-50">
          Transport: Streamable HTTP (single-request mode, no SSE session). Compatible with Claude Desktop, Cursor, and any client supporting the MCP 2025-03-26 spec.
        </section>

      </main>
    </div>
  );
}

function ToolRow({ name, desc }: { name: string; desc: string }) {
  return (
    <li class="border-l-2 border-rust pl-4">
      <div class="font-mono text-sm font-semibold text-ink">{name}</div>
      <div class="text-sm text-ink-70 mt-0.5">{desc}</div>
    </li>
  );
}

function CurlBlock({ title, cmd }: { title: string; cmd: string }) {
  return (
    <div class="border border-ink-15 bg-paper-2">
      <div class="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60 border-b border-ink-15">{title}</div>
      <pre class="bg-ink-deep text-paper p-3 font-mono text-[11px] overflow-auto whitespace-pre m-0">{cmd}</pre>
    </div>
  );
}
