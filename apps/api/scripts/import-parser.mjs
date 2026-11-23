import ts from 'typescript';

/**
 * Read module specifiers from the TypeScript AST instead of matching source text.
 * Only literal dynamic imports can be safely added to a dependency graph.
 */
export function parseModuleImports(source, filename = 'source.ts') {
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
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(parsed, visit);
  return imports;
}

/**
 * Read only explicit, literal `@Module({ exports: [...] })` entries.
 * Runtime consumers must not assume a service is injectable merely because
 * its source file can be imported. This is static analysis; no Nest bootstrap.
 */
export function parseNestModuleExports(source, filename = 'feature.module.ts') {
  const parsed = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exported = new Set();

  for (const declaration of parsed.statements) {
    if (!ts.isClassDeclaration(declaration)) continue;
    for (const decorator of ts.getDecorators(declaration) ?? []) {
      const call = decorator.expression;
      if (!ts.isCallExpression(call)) continue;
      if (!ts.isIdentifier(call.expression) || call.expression.text !== 'Module') continue;
      const metadata = call.arguments[0];
      if (!metadata || !ts.isObjectLiteralExpression(metadata)) continue;

      for (const property of metadata.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (!ts.isIdentifier(property.name) || property.name.text !== 'exports') continue;
        if (!ts.isArrayLiteralExpression(property.initializer)) continue;
        for (const element of property.initializer.elements) {
          if (ts.isIdentifier(element)) exported.add(element.text);
        }
      }
    }
  }

  return exported;
}
