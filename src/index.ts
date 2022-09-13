import * as core from "@actions/core";

import * as checkout from "./checkout";
import { updateGlobalCredential } from "./checkout";
import * as githubApp from "./github_app";

async function run(): Promise<void> {
    const githubInput = githubApp.prepareInput();
    const appToken = await githubApp.installationToken(githubInput);

    const checkoutInputs = checkout.prepareInput();
    checkoutInputs.forEach(inp => checkout.checkoutRepository(appToken, inp));

    if (core.getInput("add_git_config").toLowerCase() === "true") {
        await updateGlobalCredential(
            appToken,
            core.getInput("cwd", { required: true })
        );
    }
}

run();
