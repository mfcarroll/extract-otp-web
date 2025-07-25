import protobuf from "protobufjs";
import path from "path";

// This setup file is run by Vitest before any tests.
// It patches the `protobuf.load` function to handle web-style absolute paths
// during tests, which run in a Node.js file system environment.

const originalLoad = protobuf.load;

// Re-assign the load function to our wrapper.
protobuf.load = function (...args: any[]): any {
  let filename = args[0];
  const restOfArgs = args.slice(1);

  // If the path is a bare filename (like "google_auth.proto"), it's likely
  // intended to be loaded from the `public` directory in a browser context.
  // remap it to a local file system path relative to the project root.
  if (
    typeof filename === "string" &&
    !filename.includes(path.sep) &&
    !filename.startsWith(".")
  ) {
    // __dirname in this context is /path/to/project/tests
    filename = path.resolve(__dirname, `../public/`, filename);
  }

  // Call the original function with the (potentially modified) path and the
  // rest of the original arguments.
  return originalLoad(filename, ...restOfArgs);
};
