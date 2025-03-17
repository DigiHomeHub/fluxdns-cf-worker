/**
 * Upload API Handler
 *
 * Handles uploading domain lists, IP lists, and hosts files to KV storage.
 * Provides endpoints for managing data files used by the DNS proxy.
 */

import { clearCache } from "../core/data-loader.js";

/**
 * Handle upload request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment with KV bindings
 * @returns {Promise<Response>} HTTP response
 */
export async function handleUploadRequest(request, env) {
  // Validate method
  if (request.method !== "POST" && request.method !== "PUT") {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Only POST and PUT methods are supported",
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          Allow: "POST, PUT",
        },
      }
    );
  }

  // Get file type and name from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Path should be like /api/upload/{type}/{name}
  if (
    pathParts.length < 4 ||
    pathParts[0] !== "api" ||
    pathParts[1] !== "upload"
  ) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Invalid upload path. Use /api/upload/{type}/{name}",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const fileType = pathParts[2];
  const fileName = pathParts[3];

  // Validate file type
  if (!["domains", "ips", "hosts"].includes(fileType)) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Invalid file type. Use domains, ips, or hosts",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Validate file name
  if (!fileName || fileName.includes("..") || fileName.includes("/")) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Invalid file name",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Get file content
    const contentType = request.headers.get("Content-Type") || "";
    let fileContent;

    if (contentType.includes("text/plain")) {
      fileContent = await request.text();
    } else if (contentType.includes("application/json")) {
      const jsonData = await request.json();

      // Convert JSON data to appropriate format
      if (fileType === "domains" || fileType === "ips") {
        // Expecting an array of strings
        if (!Array.isArray(jsonData)) {
          return new Response(
            JSON.stringify({
              status: "error",
              message: "JSON payload must be an array of strings",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Convert array to text format (one item per line)
        fileContent = jsonData.join("\n");
      } else if (fileType === "hosts") {
        // Expecting an object mapping hostnames to IPs
        if (typeof jsonData !== "object" || Array.isArray(jsonData)) {
          return new Response(
            JSON.stringify({
              status: "error",
              message:
                "JSON payload must be an object mapping hostnames to IPs",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Convert object to hosts format
        fileContent = Object.entries(jsonData)
          .map(([hostname, ip]) => `${ip} ${hostname}`)
          .join("\n");
      }
    } else {
      return new Response(
        JSON.stringify({
          status: "error",
          message:
            "Unsupported content type. Use text/plain or application/json",
        }),
        {
          status: 415,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Generate KV key
    const kvKey = `${fileType}/${fileName}`;

    // Check if DATA_KV binding exists
    if (!env.DATA_KV) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "DATA_KV binding not configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Upload to KV
    await env.DATA_KV.put(kvKey, fileContent);

    // Clear cache for the updated file type
    clearCache(fileType);

    return new Response(
      JSON.stringify({
        status: "success",
        message: `File uploaded: ${fileType}/${fileName}`,
        size: fileContent.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error handling upload:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        message: `Upload failed: ${error.message}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle file list request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment with KV bindings
 * @returns {Promise<Response>} HTTP response
 */
export async function handleListRequest(request, env) {
  // Get file type from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Path should be like /api/files or /api/files/{type}
  if (
    pathParts.length < 2 ||
    pathParts[0] !== "api" ||
    pathParts[1] !== "files"
  ) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Invalid path. Use /api/files or /api/files/{type}",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Get optional type filter
  const fileType = pathParts.length >= 3 ? pathParts[2] : null;

  // Validate file type if provided
  if (fileType && !["domains", "ips", "hosts"].includes(fileType)) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Invalid file type. Use domains, ips, or hosts",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Check if DATA_KV binding exists
    if (!env.DATA_KV) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "DATA_KV binding not configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // List keys in KV
    const prefix = fileType ? `${fileType}/` : "";
    const { keys } = await env.DATA_KV.list({ prefix });

    // Group files by type
    const files = {
      domains: [],
      ips: [],
      hosts: [],
    };

    keys.forEach(({ name }) => {
      const [type, fileName] = name.split("/");
      if (files[type]) {
        files[type].push(fileName);
      }
    });

    // Return list
    if (fileType) {
      return new Response(
        JSON.stringify({
          status: "success",
          files: files[fileType],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          status: "success",
          files,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error listing files:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        message: `Failed to list files: ${error.message}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
