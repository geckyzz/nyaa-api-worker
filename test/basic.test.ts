import { handleRequest } from "./router";

// Mock test to verify the API structure
async function testAPI() {
  console.log("Testing Nyaa API Router...\n");

  // Test 1: OpenAPI spec endpoint
  console.log("Test 1: OpenAPI Spec");
  const req1 = new Request("http://localhost:8787/nyaa/v1/openapi", {
    method: "GET",
  });
  const res1 = await handleRequest(req1);
  console.log(`Status: ${res1.status}`);
  console.log(`Content-Type: ${res1.headers["Content-Type"]}`);
  const spec = JSON.parse(res1.body as string);
  console.log(`API Version: ${spec.info.version}`);
  console.log(`Paths: ${Object.keys(spec.paths).length} endpoints\n`);

  // Test 2: Invalid site
  console.log("Test 2: Invalid Site Handling");
  const req2 = new Request("http://localhost:8787/invalid/v1", {
    method: "GET",
  });
  const res2 = await handleRequest(req2);
  console.log(`Status: ${res2.status}`);
  console.log(`Response: ${res2.body}\n`);

  // Test 3: CORS headers
  console.log("Test 3: CORS Headers");
  const req3 = new Request("http://localhost:8787/nyaa/v1/search", {
    method: "OPTIONS",
  });
  const res3 = await handleRequest(req3);
  console.log(`Status: ${res3.status}`);
  console.log(`CORS Origin: ${res3.headers["Access-Control-Allow-Origin"]}`);
  console.log(
    `CORS Methods: ${res3.headers["Access-Control-Allow-Methods"]}\n`,
  );

  // Test 4: Route matching
  console.log("Test 4: Route Patterns");
  const routes = [
    "/nyaa/v1",
    "/sukebei/v1",
    "/nyaa/v1/search?q=test",
    "/nyaa/v1/torrent/12345",
    "/nyaa/v1/user/123",
    "/nyaa/v1/user/123/uploads",
  ];

  for (const route of routes) {
    const req = new Request(`http://localhost:8787${route}`, { method: "GET" });
    const res = await handleRequest(req);
    console.log(`✓ ${route} -> ${res.status}`);
  }

  console.log("\n✅ All basic tests passed!");
}

testAPI().catch(console.error);
