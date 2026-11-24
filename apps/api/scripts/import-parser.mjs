import ts from 'typescript';

/**
 * Read module specifiers from the TypeScript AST instead of matching source text.
 * Only literal dynamic imports can be safely added to a dependency graph.
 */
export function parseModuleImports(
  source,
  filename = 'source.ts',
  { checkComputedRequire = false } = {},
) {
  const parsed = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = [];

  const append = (node, value, typeOnly, kind, symbols = []) => {
    if (value && ts.isStringLiteralLike(value)) {
      imports.push({ path: value.text, typeOnly, kind, symbols });
    } else {
      const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
      imports.push({ path: null, typeOnly, kind, line });
    }
  };

  for (const declaration of parsed.statements) {
    if (ts.isImportDeclaration(declaration)) {
      const clause = declaration.importClause;
      const named = clause?.namedBindings;
      const inlineTypesOnly =
        !clause?.name &&
        named &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((binding) => binding.isTypeOnly);
      append(
        declaration,
        declaration.moduleSpecifier,
        Boolean(clause?.isTypeOnly || inlineTypesOnly),
        'static-import',
        !clause?.isTypeOnly && named && ts.isNamedImports(named)
          ? named.elements
              .filter((binding) => !binding.isTypeOnly)
              .map((binding) => binding.propertyName?.text ?? binding.name.text)
          : [],
      );
    } else if (ts.isExportDeclaration(declaration) && declaration.moduleSpecifier) {
      const named = declaration.exportClause;
      const inlineTypesOnly =
        named &&
        ts.isNamedExports(named) &&
        named.elements.length > 0 &&
        named.elements.every((binding) => binding.isTypeOnly);
      append(
        declaration,
        declaration.moduleSpecifier,
        Boolean(declaration.isTypeOnly || inlineTypesOnly),
        're-export',
      );
    } else if (
      ts.isImportEqualsDeclaration(declaration) &&
      ts.isExternalModuleReference(declaration.moduleReference)
    ) {
      append(
        declaration,
        declaration.moduleReference.expression,
        Boolean(declaration.isTypeOnly),
        'import-equals',
      );
    }
  }

  const visit = (node) => {
    if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument)) {
        append(node, argument.literal, true, 'type-query');
      }
      return;
    }

    if (ts.isCallExpression(node)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const requireCall = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (dynamicImport || requireCall) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) {
          append(node, argument, false, dynamicImport ? 'dynamic-import' : 'require');
        } else if (dynamicImport) {
          append(node, null, false, 'dynamic-unresolved');
        } else if (checkComputedRequire) {
          append(node, null, false, 'require-unresolved');
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(parsed, visit);
  return imports;
}

/**
 * Read explicit class-based Nest metadata without evaluating application code.
 * Factory/value tokens and dynamic metadata are intentionally out of scope.
 */
export function parseNestModuleMetadata(source, filename = 'feature.module.ts') {
  const parsed = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const metadata = {
    providers: new Set(),
    controllers: new Set(),
    exports: new Set(),
  };

  for (const declaration of parsed.statements) {
    if (!ts.isClassDeclaration(declaration)) continue;
    for (const decorator of ts.getDecorators(declaration) ?? []) {
      const call = decorator.expression;
      if (!ts.isCallExpression(call)) continue;
      if (!ts.isIdentifier(call.expression) || call.expression.text !== 'Module') continue;
      const options = call.arguments[0];
      if (!options || !ts.isObjectLiteralExpression(options)) continue;

      for (const property of options.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (!ts.isIdentifier(property.name)) continue;
        const registered = metadata[property.name.text];
        if (!registered || !ts.isArrayLiteralExpression(property.initializer)) continue;
        for (const element of property.initializer.elements) {
          if (ts.isIdentifier(element)) registered.add(element.text);
        }
      }
    }
  }

  return metadata;
}

/** Keep the original exports-only API for feature import validation. */
export function parseNestModuleExports(source, filename = 'feature.module.ts') {
  return parseNestModuleMetadata(source, filename).exports;
}

/**
 * Read simple class-typed constructor dependencies, without treating explicit
 * @Inject tokens, @Optional dependencies or primitives as class injections.
 * Callers decide which declared classes are registered Nest providers.
 */
export function parseClassConstructorDependencies(source, filename = 'source.ts') {
  const parsed = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const classes = [];

  for (const declaration of parsed.statements) {
    if (!ts.isClassDeclaration(declaration) || !declaration.name) continue;
    const constructor = declaration.members.find((member) => ts.isConstructorDeclaration(member));
    const dependencies = [];
    for (const parameter of constructor?.parameters ?? []) {
      const type = parameter.type;
      if (!type || !ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName)) continue;
      const decorators = ts.getDecorators(parameter) ?? [];
      if (
        decorators.some((decorator) => {
          const expression = decorator.expression;
          const name = ts.isCallExpression(expression) ? expression.expression : expression;
          return ts.isIdentifier(name) && (name.text === 'Inject' || name.text === 'Optional');
        })
      ) {
        continue;
      }
      dependencies.push(type.typeName.text);
    }
    classes.push({ name: declaration.name.text, dependencies });
  }

  return classes;
}
