import { Command } from "commander";
import { FrontendAnalyzer } from "./analyzer";
import * as fs from "fs";
import * as path from "path";

const program = new Command();

program
    .name("cohesion-fe-analyzer")
    .description("Analyze frontend codebases for API contract usage")
    .version("1.0.0")
    .requiredOption("-p, --project <path>", "Path to the frontend project root (containing tsconfig.json)")
    .option("-o, --output <path>", "Output file for the generated Schema IR JSON")
    .action((options) => {
        try {
            const projectPath = path.resolve(options.project);
            if (!fs.existsSync(projectPath)) {
                console.error(`Error: Project path does not exist: ${projectPath}`);
                process.exit(1);
            }

            const analyzer = new FrontendAnalyzer(projectPath);
            console.log(`Analyzing project at: ${projectPath}...`);

            const results = analyzer.analyze();

            const output = JSON.stringify(results, null, 2);
            if (options.output) {
                const outputPath = path.resolve(options.output);
                fs.writeFileSync(outputPath, output);
                console.log(`Successfully wrote ${results.length} schemas to ${outputPath}`);
            } else {
                console.log(output);
            }
        } catch (error) {
            console.error("Analysis failed:", error);
            process.exit(1);
        }
    });

program.parse();
