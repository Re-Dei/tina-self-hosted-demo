import { createDatabase, TinaLevelClient } from "@tinacms/graphql";
import { MongodbLevel } from "mongodb-level";
import { Octokit } from "@octokit/rest";
import { Base64 } from "js-base64";

// Manage this flag in your CI/CD pipeline and make sure it is set to false in production
const isLocal = process.env.TINA_IS_LOCAL === "true";

if (isLocal) console.log("Running TinaCMS in local mode.");
else console.log("Running TinaCMS in production mode.");

const owner = process.env.GITHUB_OWNER as string;
const repo = process.env.GITHUB_REPO as string;
const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN as string;
const branch = process.env.GITHUB_BRANCH as string;

const octokit = new Octokit({
  auth: token,
});

const localLevelStore = new TinaLevelClient();
const mongodbLevelStore = new MongodbLevel<string, Record<string, any>>({
  collectionName: "tinacms",
  dbName: "tinacms",
  mongoUri: process.env.MONGODB_URI as string,
});
if (isLocal) localLevelStore.openConnection();

const githubOnPut = async (key, value) => {
  let sha;
  try {
    const {
      data: { sha: existingSha },
    } = await octokit.repos.getContent({
      owner,
      repo,
      path: key,
      branch,
    });
    sha = existingSha;
  } catch (e) {}

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: key,
    message: "commit from self-hosted tina",
    content: Base64.encode(value),
    branch,
    sha,
  });
};

const githubOnDelete = async (key) => {
  let sha;
  try {
    const {
      data: { sha: existingSha },
    } = await octokit.repos.getContent({
      owner,
      repo,
      path: key,
      branch,
    });
    sha = existingSha;
  } catch (e) {
    console.log(e);
  }
  if (sha) {
    const { data } = await octokit.repos.deleteFile({
      owner,
      repo,
      path: key,
      message: "commit from self-hosted tina",
      branch,
      sha,
    });
    console.log("data", data);
  }
};

export default createDatabase({
  level: isLocal ? localLevelStore : mongodbLevelStore,
  onPut: isLocal ? undefined : githubOnPut,
  onDelete: isLocal ? undefined : githubOnDelete,
});
