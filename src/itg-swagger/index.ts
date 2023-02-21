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

export function itgSwagger(_options: ItgSchema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const workspaceConfigBuffer = tree.read("angular.json");
    if (!workspaceConfigBuffer) {
      throw new SchematicsException("Not an Angular CLI workspace");
    }
    const workspaceConfig = JSON.parse(workspaceConfigBuffer.toString());
    const projectName = _options.project || workspaceConfig.defaultProject;

    const project = workspaceConfig.projects[projectName];
    console.log(project);
    const defaultProjectPath = buildDefaultPath(project);


    const parasedPath = parseName(defaultProjectPath, "api.endpoints");

    const { name, path } = parasedPath;
    const finalPath = path + "/common/config";

    const apiGroup = generateEndPoints(_options, tree);

    _options.services = apiGroup.methods;
    _options.classes = generateClasses(_options, tree);

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

function getServicePath(method: any, tags: any, summary: any) {
  let service = {
    method: method,
    name: camelize(summary),
    path: tags,
  };
  return service;
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

  let groups: any = {
    methods: [],
  };
  let methods: any = [];

  for (const opPath of Object.keys(swaggerConfig.paths)) {
    // let apiPaths: any = [];
    let currentPath = opPath.substring(1);
    if (swaggerConfig.paths[opPath].get) {
      if (swaggerConfig.paths[opPath].get.summary === undefined) {
        console.log("Summary Name missing for " + opPath);
      }
      const apiServices = getServicePath(
        "get",
        currentPath,
        swaggerConfig.paths[opPath].get.summary
      );
      methods.push(apiServices);
    }

    if (swaggerConfig.paths[opPath].post) {
      if (swaggerConfig.paths[opPath].post.summary === undefined) {
        console.log("Summary Name missing for " + opPath);
      }
      const apiServices = getServicePath(
        "post",
        currentPath,
        swaggerConfig.paths[opPath].post.summary
      );
      methods.push(apiServices);
    }
  }
  groups.methods = methods;
  return groups;
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
    // console.log(opClasses);
    if (xClass.type === "object") {
      let properties = [];
      if (xClass.properties !== undefined) {
        for (const property of Object.keys(xClass.properties)) {
          const xProperties = xClass.properties[property];
          let type = getType(xProperties, swaggerConfig.components.schemas);
          let parseProperty = property + " = " + type;
          if (type === "[]") {
            parseProperty = property + ": any = " + type;
          }

          properties.push(parseProperty);
        }
        const classObj = {
          name: opClasses,
          properties: properties,
        };
        classes.push(classObj);
      }
    } else {
    }
  }
  // console.log(JSON.stringify(classes));
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
