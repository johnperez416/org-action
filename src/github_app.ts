import { Buffer } from "node:buffer";
import { env } from "node:process";

import * as core from "@actions/core";
import * as github from "@actions/github";
import { getOctokit } from "@actions/github";
import { createAppAuth, InstallationAuthOptions } from "@octokit/auth-app";
import { request } from "@octokit/request";
import ensureError from "ensure-error";
import isBase64 from "is-base64";

type Permission = {
    contents: "read" | "write" | undefined;
    actions: "write" | undefined;
    checks: "write" | undefined;
    administration: "read" | undefined;
    pull_requests: "write" | undefined;
    issues: "read" | "write" | undefined;
    workflows: "read" | "write" | undefined;
};
type Input = {
    appId: string;
    appPrivateKey: string;
    permission: Permission;
};

export const prepareInput = (): Input => {
    const appId = core.getInput("app_id") || process.env.GITHUB_APP_ID || "";
    const privateKeyInput =
        core.getInput("app_private_key") ||
        process.env.GITHUB_APP_PRIVATE_KEY ||
        "";

    if (!appId || !privateKeyInput) {
        throw new Error("appId or privateKeyInput is empty");
    }

    const permissionInput = core
        .getInput("app_permission", { required: true })
        .split(",");
    const hasPermission = (name: string) =>
        !!permissionInput.find(x => x === name);

    const appPrivateKey = isBase64(privateKeyInput)
        ? Buffer.from(privateKeyInput, "base64").toString("utf8")
        : privateKeyInput;

    const permission: Permission = {
        contents: hasPermission("contents-rw")
            ? "write"
            : hasPermission("contents-ro")
            ? "read"
            : undefined,
        actions: hasPermission("actions-rw") ? "write" : undefined,
        checks: hasPermission("checks-rw") ? "write" : undefined,
        administration: hasPermission("administration-ro") ? "read" : undefined,
        pull_requests: hasPermission("pull-requests-rw") ? "write" : undefined,
        workflows: hasPermission("workflows-rw") ? "write" : undefined,
        issues: hasPermission("issues-rw")
            ? "write"
            : hasPermission("issues-ro")
            ? "read"
            : undefined,
    };

    return {
        appId,
        appPrivateKey,
        permission
    };
};

export const installationToken = async (input: Input) => {
    const org = github.context.repo.owner;
    const app = createAppAuth({
        appId: input.appId,
        privateKey: input.appPrivateKey,
        request: request.defaults({
            // GITHUB_API_URL is part of GitHub Actions' built-in environment variables.
            // See https://docs.github.com/en/actions/reference/environment-variables#default-environment-variables.
            baseUrl: env.GITHUB_API_URL
        })
    });

    const authApp = await app({ type: "app" });
    const octokit = getOctokit(authApp.token);
    let installationId;
    try {
        ({
            data: { id: installationId }
        } = await octokit.rest.apps.getOrgInstallation({ org }));
    } catch (error: unknown) {
        throw new Error(
            `Could not get repo installation. Is the app installed on this org? : ${ensureError(
                error
            )}`
        );
    }

    try {
        ({
            data: { id: installationId }
        } = await octokit.rest.apps.getRepoInstallation({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo
        }));
    } catch (error: unknown) {
        throw new Error(
            `org-action을 해당 레포에서 사용하려면 #req-devops 채널에 요청해주세요 : ${ensureError(
                error
            )}`
        );
    }

    const installation = await app({
        installationId,
        permissions: input.permission,
        type: "installation"
    } as InstallationAuthOptions);
    return installation.token;
};
