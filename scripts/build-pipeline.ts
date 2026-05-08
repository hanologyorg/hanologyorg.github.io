import { LibraryPipeline } from '../src/cham/library-pipeline'

const pipeline = new LibraryPipeline(
  'content',
  'data',
  'site/public/data',
)

pipeline.run()
