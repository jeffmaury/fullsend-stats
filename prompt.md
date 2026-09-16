Establish a plan for a website that will be published on this repository github pages.

The website is build following:
- every day a workflow will run that will check the pull request from fullsend-ai-coder[bot] on repository openkaiden/kaiden. For each pull request, it will count the pull request that:
  - closed without merged (only for closed pull request)
  - pull requests that have at leat one /fs-fix comment
  - pull request that have fullsend-with-human label

Info should be computed for opened and closed pull request.

The websote should be able to report imformation:
- per day
- per weeks
- per months
