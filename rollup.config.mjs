// Copyright (c) 2021-2025 Littleton Robotics
// http://github.com/Mechanical-Advantage
//
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file
// at the root directory of this project.

import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import fs from "fs";
import cleanup from "rollup-plugin-cleanup";
import replaceRegEx from "rollup-plugin-re";

const licenseHeader =
  "// Copyright (c) 2021-2025 Littleton Robotics\n// http://github.com/Mechanical-Advantage\n//\n// Use of this source code is governed by a BSD\n// license that can be found in the LICENSE file\n// at the resources directory of this application.\n";

function bundle(input, output, isMain, isXRClient, external = []) {
  const isWpilib = process.env.ASCOPE_DISTRIBUTOR === "WPILIB";
  return {
    input: "src/" + input,
    output: {
      file: "bundles/" + output,
      format: isMain ? "cjs" : "es",
      banner: licenseHeader
    },
    context: "this",
    external: external,
    plugins: [
      typescript(),
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      ...(isXRClient
        ? [
            getBabelOutputPlugin({
              presets: [["@babel/preset-env", { modules: false }]],
              compact: true,
              targets: "iOS 16" // AdvantageScope XR is built for iOS 16
            }),
            terser()
          ]
        : [cleanup()]),
      json(),
      replace({
        preventAssignment: true,
        values: {
          __distributor__: isWpilib ? "WPILib" : "FRC6328",
          __build_date__: new Date().toLocaleString("en-US", {
            timeZone: "UTC",
            hour12: false,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            timeZoneName: "short"
          }),
          __copyright__: JSON.parse(
            fs.readFileSync("package.json", {
              encoding: "utf-8"
            })
          ).build.copyright
        }
      }),
      replaceRegEx({
        patterns: [
          // Remove unused eval in protobufjs
          // https://github.com/protobufjs/protobuf.js/issues/593
          {
            test: /eval.*\(moduleName\);/g,
            replace: "undefined;"
          },

          // Remove dependency on node:sqlite (not actually
          // used, so just replace with stand-in dependency)
          {
            test: /node:sqlite/g,
            replace: "fs"
          }
        ]
      })
    ],
    onwarn(message, warn) {
      // Hide warnings about protobufjs circular dependencies
      // https://github.com/protobufjs/protobuf.js/issues/1402
      if (message.code === "CIRCULAR_DEPENDENCY") return;
      warn(message);
    }
  };
}

const mainBundles = [
  bundle("main/main.ts", "main.js", true, false, [
    "electron",
    "electron-fetch",
    "fs",
    "jsonfile",
    "net",
    "os",
    "ws",
    "http",
    "path",
    "basic-ftp",
    "download",
    "ytdl-core",
    "tesseract.js"
  ]),
  bundle("preload.ts", "preload.js", true, false, ["electron"])
];
const largeRendererBundles = [
  bundle("hub/hub.ts", "hub.js", false, false),
  bundle("satellite.ts", "satellite.js", false, false)
];
const smallRendererBundles = [
  bundle("editRange.ts", "editRange.js", false, false),
  bundle("unitConversion.ts", "unitConversion.js", false, false),
  bundle("renameTab.ts", "renameTab.js", false, false),
  bundle("editFov.ts", "editFov.js", false, false),
  bundle("sourceListHelp.ts", "sourceListHelp.js", false, false),
  bundle("betaWelcome.ts", "betaWelcome.js", false, false),
  bundle("export.ts", "export.js", false, false),
  bundle("download.ts", "download.js", false, false),
  bundle("preferences.ts", "preferences.js", false, false),
  bundle("licenses.ts", "licenses.js", false, false)
];
const workerBundles = [
  bundle("hub/dataSources/rlog/rlogWorker.ts", "hub$rlogWorker.js", false, false),
  bundle("hub/dataSources/wpilog/wpilogWorker.ts", "hub$wpilogWorker.js", false, false),
  bundle("hub/dataSources/dslog/dsLogWorker.ts", "hub$dsLogWorker.js", false, false),
  bundle("hub/exportWorker.ts", "hub$exportWorker.js", false, false),
  bundle("shared/renderers/field3d/workers/loadField.ts", "shared$loadField.js", false, false),
  bundle("shared/renderers/field3d/workers/loadRobot.ts", "shared$loadRobot.js", false, false)
];
const xrBundles = [
  bundle("xrClient/xrClient.ts", "xrClient.js", false, true),
  bundle("xrControls.ts", "xrControls.js", false, false)
];
const runOwletDownload = {
  input: "src/runOwletDownload.ts",
  output: {
    file: "runOwletDownload.js",
    format: "cjs"
  },
  context: "this",
  external: ["download"],
  plugins: [
    typescript(),
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs(),
    json()
  ],
  onwarn() {}
};

export default (cliArgs) => {
  if (cliArgs.configMain === true) return mainBundles;
  if (cliArgs.configLargeRenderers === true) return largeRendererBundles;
  if (cliArgs.configSmallRenderers === true) return smallRendererBundles;
  if (cliArgs.configWorkers === true) return workerBundles;
  if (cliArgs.configXR === true) return xrBundles;
  if (cliArgs.configRunOwletDownload === true) return runOwletDownload;

  return [...mainBundles, ...largeRendererBundles, ...smallRendererBundles, ...workerBundles, ...xrBundles];
};
