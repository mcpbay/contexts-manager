export function resourceMeta() {
  return {
    name: "concept",
    description: "My useful resource",
    title: "Concept",
    mimeType: "text/markdown",
  };
}

export function resourceHandler() {
  return "This is a script-based resource from the example MCPBay context.";
}
