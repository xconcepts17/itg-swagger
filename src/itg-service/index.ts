import { strings } from "@angular-devkit/core";
import { camelize } from "@angular-devkit/core/src/utils/strings";
import {
  apply,
  Rule,
  template,
  SchematicContext,
  SchematicsException,
  Tree,
  url,
  move,
  forEach,
  FileEntry,
  mergeWith,
} from "@angular-devkit/schematics";
import { parseName } from "@schematics/angular/utility/parse-name";
import { buildDefaultPath } from "@schematics/angular/utility/workspace";
import { ItgSchema } from "./itg-schema";

export function itgService(_options: ItgSchema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const workspaceConfigBuffer = tree.read("angular.json");
    if (!workspaceConfigBuffer) {
      throw new SchematicsException("Not an Angular CLI workspace");
    }
    const workspaceConfig = JSON.parse(workspaceConfigBuffer.toString());
    const projectName = _options.project || workspaceConfig.defaultProject;
    const project = workspaceConfig.projects[projectName];

    const defaultProjectPath = buildDefaultPath(project);

    const parasedPath = parseName(defaultProjectPath, _options.name);

    const { name, path } = parasedPath;

    _options.services = generateServices(_options, tree);
    console.log(_options.services);

    const sourceTemplates = url("./files");

    const sourceParametrizedTemplates = apply(sourceTemplates, [
      template({
        ..._options,
        ...strings,
        name,
      }),
      move(path),
      // fix for https://github.com/angular/angular-cli/issues/11337
      forEach((fileEntry: FileEntry) => {
        if (tree.exists(fileEntry.path)) {
          tree.overwrite(fileEntry.path, fileEntry.content);
        }
        return fileEntry;
      }),
    ]);
    return mergeWith(sourceParametrizedTemplates)(tree, _context);
  };
}

function generateServices(_options: any, tree: any) {
  const swaggerPath = _options.swaggerPath
    ? _options.swaggerPath
    : "swagger.json";
  // Get the Swagger JSON
  const swaggerConfigBuffer = tree.read(swaggerPath);
  if (!swaggerConfigBuffer) {
    throw new SchematicsException("No swagger.json in workspace");
  }
  const swaggerConfig = JSON.parse(swaggerConfigBuffer.toString());
  let services: any = [];
  for (const opPath of Object.keys(swaggerConfig.paths)) {
    let currentTags = "";
    swaggerConfig.paths[opPath].get
      ? (currentTags = swaggerConfig.paths[opPath].get.tags[0])
      : (currentTags = swaggerConfig.paths[opPath].post.tags[0]);

    let currentTagArray = currentTags.split("/");
    let currentTag = camelize(currentTagArray[currentTagArray.length - 1]);
    let currentNameArray = _options.name.split("/");
    let currentName = camelize(currentNameArray[currentNameArray.length - 1]);
    // console.log(currentTag, currentName);
    if (currentTag === currentName) {
      if (swaggerConfig.paths[opPath].get) {
        const obj = {
          methodName: "",
          tag: currentName,
          schema: "",
        };
        obj.methodName = camelize(swaggerConfig.paths[opPath].get.summary);
        services.push(obj);
      }
      if (swaggerConfig.paths[opPath].post) {
        const obj = {
          methodName: "",
          tag: currentName,
          schema: "",
        };
        obj.methodName = camelize(swaggerConfig.paths[opPath].post.summary);
        services.push(obj);
      }

      // console.log(obj);
    }
  }
  return services;
}
