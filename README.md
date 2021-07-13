# Next.js Bundle Analysis Github Action

Analyzes each PR's impact on your next.js app's bundle size and displays it using a comment. Optionally supports performance budgets.

![screenshot of bundle analysis comment](https://p176.p0.n0.cdn.getcloudapp.com/items/BluKP76d/2b51f74a-9c0f-481f-b76a-9b36cf37d369.png?v=ddd23d0d9ee1ee9ad40487d181ed917f)

### Usage

> **NOTE**: Due to github actions' lack of support for more complex actions, the experience of getting this set up is unusual in that it requires a generation script which copies most of the logic into your project directly. As soon as github adds support for the [features](https://github.com/actions/runner/pull/1144) [needed](https://github.com/actions/runner/pull/1144#discussion_r651087316) to properly package up this action, we'll put out an update that removes the extra boilerplate and makes usage much simpler. Until then, we all have no choice but to endure this unusual setup process.

```sh
$ npx nextjs-bundle-analysis generate
```
