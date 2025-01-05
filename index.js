#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import degit from "degit";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import { spawn } from "child_process";

const program = new Command();

program.version("1.0.0").description("ccx-cli 用于创建react/vue项目");


// 接收init命令初始化项目
program
  .command("init <projectName>")
  .description("请选择类型")
  .option("-r --react", "使用react模板")
  .option("-v --vue", "使用vue模板")
  .option("-t --ts", "使用ts")
  .option("-j --js", "使用js")
  .action(async (projectName, options) => {

    const { react, vue, ts, js } = options;

    let framework = react ? "react" : vue ? "vue" : null;
    let language = ts ? "ts" : js ? "js" : null;

    // 判断用户是否指定框架或语言，以此来确定是否询问
    const questions = [];
    if (!framework) {
      questions.push({
        type: 'list',
        name: 'framework',
        message: '选择框架:',
        choices: ['react', 'vue']
      })
    }
    if (!language) {
      questions.push({
        type: 'list',
        name: 'language',
        message: '选择语言类型',
        choices: ['ts', 'js'],
      })
    }
    if (questions.length) {
      const answers = await inquirer.prompt(questions)

      framework = framework || answers.framework;
      language = language || answers.language;
    }

    await cloneTemplate({
      projectName,
      framework,
      language
    })
  })

// 根据用户选择来下载模板
async function cloneTemplate(options) {
  const { projectName, framework, language } = options;
  if (!framework || !language) {
    console.log(chalk.red("未检测到选择框架或语言，请重试"));
    process.exit(1);
  }
  const gitUrl = `github:chencanxi/ccx-${framework}-template#${language === 'js' ? 'main' : 'ts'}`;
  console.log(chalk.cyan("从代码仓库克隆代码..."))
  const emitter = degit(gitUrl, { cache: false, force: true });

  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    console.log(chalk.yellow(projectName) + chalk.red("项目已存在"));
    process.exit(1);
  } else {
    fs.mkdirSync(targetDir);
  }

  const spinner = ora(chalk.yellow("下载模板中..."));
  // 监听 degit 的 'info' 事件，更新 spinner 文本
  emitter.on('info', info => {
    spinner.text = chalk.yellow(info.message);
  });

  try {
    await emitter.clone(targetDir);
    spinner.succeed("下载成功");

    const { installDeps } = await inquirer.prompt([
      {
        type: "confirm",
        name: "installDeps",
        message: "是否自动安装依赖",
        default: true
      }
    ])

    if (installDeps) {
      await installDependencies(projectName)
    }

  } catch (err) {
    spinner.fail(`下载失败${err}`)
  }
}

async function installDependencies(projectDir) {
  const spinner = ora(chalk.yellow("正在安装依赖...")).start();

  // 如果想允许用户选择 npm / yarn / pnpm，可以再问一次 inquirer
  // 这里我们默认用 npm
  return new Promise((resolve, reject) => {
    const cmd = "npm";
    const args = ["install"];

    const child = spawn(cmd, args, {
      cwd: projectDir,
      stdio: "inherit", // 直接将子进程输出传递到主进程
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        spinner.succeed("依赖安装成功！");
        resolve(0);
      } else {
        spinner.fail("依赖安装失败，请手动执行 npm install");
        reject(new Error(`安装进程退出，code=${code}`));
      }
    });

    child.on("error", (err) => {
      spinner.fail(`依赖安装过程中出错：${err.message}`);
      reject(err);
    });
  });
}

program.parse(process.argv);