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
import { buildDefaultPath } from "@schematics/angular/utility/project";
import { ItgSchema } from "./itg-schema";

export function itgSwagger(_options: ItgSchema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const workspaceConfigBuffer = tree.read("angular.json");
    if (!workspaceConfigBuffer) {
      throw new SchematicsException("Not an Angular CLI workspace");
    }
    const workspaceConfig = JSON.parse(workspaceConfigBuffer.toString());
    const projectName = _options.project || workspaceConfig.defaultProject;
    const project = workspaceConfig.projects[projectName];

    const defaultProjectPath = buildDefaultPath(project);

    const parasedPath = parseName(defaultProjectPath, "api.endpoints");

    const { name, path } = parasedPath;
    const finalPath = path + "/common/config";

    _options.endPoints = generateEndPoints(_options, tree);
    _options.classes = generateClasses(_options, tree);

    // console.log(JSON.stringify(_options.classes));
    // return;

    const sourceTemplates = url("./files");

    const sourceParametrizedTemplates = apply(sourceTemplates, [
      template({
        ..._options,
        ...strings,
        name,
      }),
      move(finalPath),
      // fix for https://github.com/angular/angular-cli/issues/11337
      forEach((fileEntry: FileEntry) => {
        if (tree.exists(fileEntry.path)) {
          tree.overwrite(fileEntry.path, fileEntry.content);
        }
        return fileEntry;
      }),
    ]);
    return mergeWith(sourceParametrizedTemplates)(tree, _context);

    return tree;
  };
}
function getPathFn(paths: any, summary: any) {
  let summaryName: any = "";
  if (summary) {
    summaryName = camelize(summary);
  }
  const endPointPath =
    summaryName + ": AppConfig.basePath + '" + paths.substring(1) + "'";
  return endPointPath;
}
function generateEndPoints(_options: any, tree: any) {
  const swaggerPath = _options.swaggerPath
    ? _options.swaggerPath
    : "swagger.json";
  // Get the Swagger JSON
  const swaggerConfigBuffer = tree.read(swaggerPath);
  if (!swaggerConfigBuffer) {
    throw new SchematicsException("No swagger.json in workspace");
  }
  const swaggerConfig = JSON.parse(swaggerConfigBuffer.toString());

  let tags: any = [];
  for (const opPath of Object.keys(swaggerConfig.paths)) {
    let currentTags = "";
    swaggerConfig.paths[opPath].get
      ? (currentTags = swaggerConfig.paths[opPath].get.tags[0])
      : (currentTags = swaggerConfig.paths[opPath].post.tags[0]);

    let currentTagArray = currentTags.split("/");

    let currentTag = camelize(currentTagArray[currentTagArray.length - 1]);

    const index = tags
      .map(function (e: any) {
        return e.tag;
      })
      .indexOf(currentTag);
    if (index === -1) {
      let apiPaths: any = [];
      if (swaggerConfig.paths[opPath].get) {
        const apiEndpointPath = getPathFn(
          opPath,
          swaggerConfig.paths[opPath].get.summary
        );
        apiPaths.push(apiEndpointPath);
      }
      if (swaggerConfig.paths[opPath].post) {
        const apiEndpointPath = getPathFn(
          opPath,
          swaggerConfig.paths[opPath].post.summary
        );
        apiPaths.push(apiEndpointPath);
      }
      let endPointObject = {
        tag: currentTag,
        paths: apiPaths,
      };
      tags.push(endPointObject);
    } else {
      if (swaggerConfig.paths[opPath].get) {
        const apiEndpointPath = getPathFn(
          opPath,
          swaggerConfig.paths[opPath].get.summary
        );
        tags[index].paths.push(apiEndpointPath);
      }
      if (swaggerConfig.paths[opPath].post) {
        const apiEndpointPath = getPathFn(
          opPath,
          swaggerConfig.paths[opPath].post.summary
        );
        tags[index].paths.push(apiEndpointPath);
      }
    }
  }
  return tags;
  // console.log(JSON.stringify(tags));
}

function generateClasses(_options: any, tree: any) {
  const swaggerPath = _options.swaggerPath
    ? _options.swaggerPath
    : "swagger.json";
  // Get the Swagger JSON
  const swaggerConfigBuffer = tree.read(swaggerPath);
  if (!swaggerConfigBuffer) {
    throw new SchematicsException("No swagger.json in workspace");
  }
  const swaggerConfig = JSON.parse(swaggerConfigBuffer.toString());
  // console.log(swaggerConfig.components.schemas);
  let classes: any = [];
  for (const opClasses of Object.keys(swaggerConfig.components.schemas)) {
    const xClass = swaggerConfig.components.schemas[opClasses];
    if (xClass.type === "object") {
      let properties = [];
      for (const property of Object.keys(xClass.properties)) {
        const xProperties = xClass.properties[property];
        let type = getType(xProperties, swaggerConfig.components.schemas);
        const parseProperty = property + " = " + type;
        properties.push(parseProperty);
      }
      const classObj = {
        name: opClasses,
        properties: properties,
      };
      classes.push(classObj);
    } else {
    }
  }
  return classes;
}

function getType(xProperties: any, schemas: any) {
  let type: any;
  if (xProperties.type === "string") {
    type = "''";
  } else if (xProperties.type === "integer") {
    type = 0;
  } else if (xProperties.type === "boolean") {
    type = false;
  } else if (xProperties.type === "array") {
    type = "[]";
  } else if (xProperties.type === undefined) {
    let ref = xProperties.$ref.toString().split("/");
    let className = ref[ref.length - 1];
    if (schemas[className].properties) {
      type = "new " + className + "()";
    } else {
      type = getType(schemas[className], schemas);
    }
  } else {
    type = xProperties.type;
  }
  return type;
}
