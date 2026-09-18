import { writeDemoBinaries } from "../src/lib/ai/demo-files";

writeDemoBinaries().then(() => {
  console.log("demo binaries written");
});
