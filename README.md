# Next.js Bundle Analysis Github Action

Analyzes each PR's impact on your next.js app's bundle size and displays it using a comment. Optionally supports performance budgets.

![screenshot of bundle analysis comment](https://p176.p0.n0.cdn.getcloudapp.com/items/BluKP76d/2b51f74a-9c0f-481f-b76a-9b36cf37d369.png?v=ddd23d0d9ee1ee9ad40487d181ed917f)

### Installation

It's pretty simple to get this set up, just run the following command and answer the prompts. The command will create a `.github/workflows` directory in your project root and add a `next_bundle_analysis.yml` file to it - that's all it takes!

```sh
$ npx -p nextjs-bundle-analysis generate
```

> **NOTE**: Due to github actions' lack of support for more complex actions, the experience of getting this set up is unusual in that it requires a generation script which copies most of the logic into your project directly. As soon as github adds support for the [features](https://github.com/actions/runner/pull/1144) [needed](https://github.com/actions/runner/pull/1144#discussion_r651087316) to properly package up this action, we'll put out an update that removes the extra boilerplate and makes usage much simpler. Until then, we all have no choice but to endure this unusual setup process.

### Configuration

Config values are written to `package.json` under the key `nextBundleAnalysis`, and can be changed there any time. You can directly edit the workflow file if you want to adjust your default branch or the directory that your nextjs app lives in (especially if you are using a `srcDir` or something similar).

There is one config value, `showDetails`, that is set to "true" by default. This option renders a collapsed "details" section under each section of the bundle analysis comment explaining some of the finer details of the numbers provided. If you feel like this is not necessary and you and/or those working on your project understand the details, you can set this option to `false` and that section will not render.

If your application builds to a directory other than `.next`, you can specify this with the key `buildOutputDirectory`.

### Caveats

- This plugin only analyzes the direct bundle output from next.js. If you have added any other scripts via the `<script>` tag, especially third party scripts and things like analytics or other tracking scripts, these are not included in the analysis. Scripts of this nature should _probably_ be loaded in behind a consent manager and should not make an impact on your initial load, and as long as this is how you handle them it should make no difference, but it's important to be aware of this and account for the extra size added by these scripts if they are present in your app.
- Since this plugin works by comparing the base bundle against each PR, the first time it is run, it will fail since it has no base to compare against. This is expected - ideally you can just commit the changes directly to your default branch, where it will run to generate the base bundle, then anything that branches off after that will have a valid comparison point and the script will work as expected.
- This script assumes that running `next build` will successfully build your application. If you need additional scripts or logic to do so, you may need to update the action step called "Build next.js app" to the command needed to build your app. For example, if you have a `npm run build` step, that would be a good target to change it to. We plan to make this configurable via the generator in the future.
