# Next.js Bundle Analysis Github Action

Analyzes each PR's impact on your next.js app's bundle size and displays it using a PR comment, a GitHub Check Run, or both. Optionally supports performance budgets.

![screenshot of bundle analysis comment](https://p176.p0.n0.cdn.getcloudapp.com/items/BluKP76d/2b51f74a-9c0f-481f-b76a-9b36cf37d369.png?v=ddd23d0d9ee1ee9ad40487d181ed917f)

## Installation

It's pretty simple to get this set up. Run the following command and answer the prompts. The command will create a `.github/workflows` directory in your project root and add a `nextjs_bundle_analysis.yml` file to it - that's all it takes!

```sh
$ npx -p nextjs-bundle-analysis generate
```

## Configuration

Config values are written to `package.json` under the key `nextBundleAnalysis`, and can be changed there any time. You can directly edit the workflow file if you want to adjust your default branch or the directory that your nextjs app lives in (especially if you are using a `srcDir` or something similar).

The reusable workflow also accepts `with:` inputs for `output-mode`, `minimum-change-threshold`, `minimum-total-change-threshold`, `skip-comment-if-empty`, `build-output-directory`, and the existing install/build settings. Workflow inputs take precedence over `package.json`.

### Example: Check-First Publishing

If you want bundle analysis to live in the GitHub Checks tab by default and only post a PR comment when bundle increases exceed practical thresholds, you can configure it like this:

```json
{
  "nextBundleAnalysis": {
    "outputMode": "check",
    "minimumChangeThreshold": 1024,
    "minimumTotalChangeThreshold": 1024,
    "skipCommentIfEmpty": true
  }
}
```

You can also override those values in the generated workflow:

```yml
jobs:
  analyze:
    uses: hashicorp/nextjs-bundle-analysis/.github/workflows/analyze.yml@<version>
    with:
      output-mode: check
      minimum-change-threshold: 1024
      minimum-total-change-threshold: 1024
      skip-comment-if-empty: true
```

### `showDetails (boolean)`

(Optional, defaults to `true`) This option renders a collapsed "details" section under each section of the bundle analysis comment explaining some of the finer details of the numbers provided. If you feel like this is not necessary and you and/or those working on your project understand the details, you can set this option to `false` and that section will not render.

### `buildOutputDirectory (string)`

(Optional, defaults to `.next`) If your application [builds to a custom directory](https://nextjs.org/docs/api-reference/next.config.js/setting-a-custom-build-directory), you can specify this with the key `buildOutputDirectory`. You can set the same value either in `package.json` or with the reusable workflow's `build-output-directory` input.

For example, if you build to `dist`, you should:

- Set `package.json.nextBundleAnalysis.buildOutputDirectory` to `"dist"`.
- In `nextjs_bundle_analysis.yml`, update the `build-output-directory` input to `dist`.

### `budget (number)`

(Optional) The file size, in bytes, to budget for first page load size. For example, if `budget` was set to `358400` (350 KB) and a page's first load size was 248 KB, the report would list that page as having used 70% of the performance budget.

### `budgetPercentIncreaseRed (number)`

(Optional, but required if `budget` is specified) If a page's first load size has increased more than `budgetPercentIncreaseRed` percent, display a 🔴 to draw attention to the change.

### `minimumChangeThreshold (number)`

(Optional, defaults to `0`) The threshold under which pages will be considered unchanged. In `outputMode: "check"`, this same threshold is also used to decide whether an increased page bundle should trigger a PR warning comment. For example, if `minimumChangeThreshold` was set to `500` and a page's size increased by `300 B`, it will be considered unchanged and will not trigger a threshold comment.

### `minimumTotalChangeThreshold (number)`

(Optional, defaults to `1024`) The threshold under which global bundle increases will not trigger a PR warning comment when `outputMode` is set to `check`. The full report still appears in the check run.

### `outputMode ("comment" | "check" | "both")`

(Optional, defaults to `"comment"`) Controls where bundle analysis is published.

- `comment`: keeps the existing behavior and posts the full report as a PR comment.
- `check`: posts the full report to a GitHub Check Run and only posts a short PR comment when bundle increases exceed the configured thresholds.
- `both`: posts the full report to both the PR conversation and a GitHub Check Run.

### `alwaysShowGzipDiff (boolean)`

(Optional, defaults to `false`) If set, the display table will show the gzip size difference for routes even when a budget is set.

### `skipCommentIfEmpty (boolean)`

(Optional, defaults to `false`) When set to `true`, if no pages have changed size the generated comment will be an empty string.

## Check Run Behavior

- In `check` and `both` modes, the action creates a real GitHub Check Run named after the package, for example `nextjs-bundle-analysis / my-app`.
- If there are no bundle changes, the check completes successfully with a `No bundle changes` message.
- If the base bundle artifact is missing, the check completes with a neutral conclusion explaining why no comparison was generated.
- In `check` mode, managed PR comments are deleted and recreated so at most one bundle-analysis comment exists on the PR, and it stays near the latest commit activity.
- In practice, use non-trivial thresholds for `minimumChangeThreshold` and `minimumTotalChangeThreshold` in `check` mode. Very small thresholds such as `1` byte can be noisy because some builds vary by a few bytes even when app code has not meaningfully changed.

## Caveats

- This plugin only analyzes the direct bundle output from next.js. If you have added any other scripts via the `<script>` tag, especially third party scripts and things like analytics or other tracking scripts, these are not included in the analysis. Scripts of this nature should _probably_ be loaded in behind a consent manager and should not make an impact on your initial load, and as long as this is how you handle them it should make no difference, but it's important to be aware of this and account for the extra size added by these scripts if they are present in your app.
- Since this plugin works by comparing the base bundle against each PR, the first time it is run there may be no base artifact to compare against. In `check` and `both` modes this now produces a neutral check explaining the issue instead of failing the comparison step.
- This script assumes that running `next build` will successfully build your application. If you need additional scripts or logic to do so, you may need to update the action step called "Build next.js app" to the command needed to build your app. For example, if you have a `npm run build` step, that would be a good target to change it to. We plan to make this configurable via the generator in the future.
