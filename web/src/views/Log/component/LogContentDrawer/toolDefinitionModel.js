const BUILTIN_TOOL_TYPES = new Set(['tool_search', 'web_search']);

const isObjectLike = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const inferSchemaType = (schema) => {
  if (!isObjectLike(schema)) {
    return Array.isArray(schema) ? 'array' : typeof schema;
  }

  if (normalizeString(schema.type)) {
    return normalizeString(schema.type);
  }

  if (isObjectLike(schema.properties) || Array.isArray(schema.required)) {
    return 'object';
  }

  if (Array.isArray(schema.oneOf)) {
    return 'oneOf';
  }

  if (Array.isArray(schema.anyOf)) {
    return 'anyOf';
  }

  if (Array.isArray(schema.enum)) {
    return 'enum';
  }

  return 'schema';
};

export const summarizeSchema = (schema) => {
  if (!schema) {
    return {
      type: '',
      summary: '未提供 Schema',
      propertyNames: [],
      requiredFields: [],
      propertyCount: 0
    };
  }

  const properties = isObjectLike(schema.properties) ? Object.keys(schema.properties) : [];
  const requiredFields = Array.isArray(schema.required) ? schema.required.filter((field) => normalizeString(field)) : [];
  const schemaType = inferSchemaType(schema);
  const propertySummary =
    properties.length === 0
      ? '无字段'
      : properties.length <= 4
        ? properties.join(', ')
        : `${properties.slice(0, 4).join(', ')} +${properties.length - 4}`;

  return {
    type: schemaType,
    summary: `${schemaType}${properties.length > 0 ? ` · ${properties.length} 个字段` : ''}${propertySummary ? ` · ${propertySummary}` : ''}`,
    propertyNames: properties,
    requiredFields,
    propertyCount: properties.length
  };
};

export const getToolType = (tool) => {
  if (!isObjectLike(tool)) return '';

  const explicitType = normalizeString(tool.type);
  if (explicitType) return explicitType;
  if (isObjectLike(tool.function)) return 'function';
  if (Array.isArray(tool.functionDeclarations)) return 'function';
  if (normalizeString(tool.name) || tool.input_schema !== undefined || tool.parameters !== undefined) {
    return 'function';
  }

  return '';
};

export const getToolDisplayName = (tool, index = 0, fallbackName = `tool_${index + 1}`) => {
  if (!isObjectLike(tool)) {
    return fallbackName;
  }

  return normalizeString(tool.function?.name) || normalizeString(tool.name) || normalizeString(tool.type) || fallbackName;
};

export const getToolDescription = (tool) => {
  if (!isObjectLike(tool)) return '';
  return normalizeString(tool.function?.description) || normalizeString(tool.description) || '';
};

export const getToolSchema = (tool) => {
  if (!isObjectLike(tool)) return null;
  if (tool.function?.parameters !== undefined) return tool.function.parameters;
  if (tool.parameters !== undefined) return tool.parameters;
  if (tool.input_schema !== undefined) return tool.input_schema;
  return null;
};

export const countNamespaceChildren = (tool) => {
  if (!isObjectLike(tool)) return 0;

  const childCollections = [tool.tools, tool.children, tool.items, tool.functionDeclarations];
  for (const collection of childCollections) {
    if (Array.isArray(collection)) {
      return collection.length;
    }
  }

  return 0;
};

export const getToolKind = (tool) => {
  const toolType = getToolType(tool);

  if (toolType === 'function') {
    return 'function';
  }

  if (toolType === 'namespace') {
    return 'namespace';
  }

  if (toolType && BUILTIN_TOOL_TYPES.has(toolType)) {
    return 'builtin';
  }

  if (toolType) {
    return 'unknown';
  }

  if (isObjectLike(tool?.function) || tool?.input_schema !== undefined || tool?.parameters !== undefined) {
    return 'function';
  }

  return 'unknown';
};

export const getToolConvertibility = (tool) => {
  const kind = getToolKind(tool);
  const toolType = getToolType(tool);

  if (kind === 'function') {
    return {
      convertible: true,
      reason: ''
    };
  }

  if (kind === 'namespace') {
    return {
      convertible: false,
      reason: 'namespace 容器工具当前无法跨协议等价转换'
    };
  }

  if (kind === 'builtin') {
    return {
      convertible: false,
      reason: `${toolType || 'builtin'} 工具当前无法跨协议等价转换`
    };
  }

  return {
    convertible: false,
    reason: toolType ? `${toolType} 类型工具当前无法跨协议等价转换` : '未知工具类型当前无法跨协议等价转换'
  };
};

const buildToolDefinitionRecord = ({ tool, index, path, raw = tool }) => {
  const schema = getToolSchema(tool);
  const schemaMeta = summarizeSchema(schema);
  const toolType = getToolType(tool) || 'unknown';
  const displayName = getToolDisplayName(tool, index);
  const kind = getToolKind(tool);
  const namespaceChildCount = kind === 'namespace' ? countNamespaceChildren(tool) : 0;

  return {
    toolType,
    displayName,
    name: displayName,
    description: getToolDescription(tool),
    schema,
    path,
    raw,
    kind,
    convertibility: getToolConvertibility(tool),
    namespaceChildCount,
    schemaSummary: schemaMeta.summary,
    schemaType: schemaMeta.type,
    schemaPropertyCount: schemaMeta.propertyCount,
    schemaPropertyNames: schemaMeta.propertyNames,
    requiredFields: schemaMeta.requiredFields
  };
};

export const extractToolDefinitionsFromTools = (tools) => {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  const definitions = [];

  tools.forEach((tool, index) => {
    if (!isObjectLike(tool)) return;

    if (Array.isArray(tool.functionDeclarations) && tool.functionDeclarations.length > 0) {
      tool.functionDeclarations.forEach((declaration, declarationIndex) => {
        if (!isObjectLike(declaration)) return;
        definitions.push(
          buildToolDefinitionRecord({
            tool: declaration,
            index: declarationIndex,
            path: `tools[${index}].functionDeclarations[${declarationIndex}]`,
            raw: declaration
          })
        );
      });
      return;
    }

    definitions.push(
      buildToolDefinitionRecord({
        tool,
        index,
        path: isObjectLike(tool.function) ? `tools[${index}].function` : `tools[${index}]`
      })
    );
  });

  return definitions;
};

export const extractToolDefinitionsFromRequest = (requestParsed) => {
  if (!isObjectLike(requestParsed)) {
    return [];
  }

  return extractToolDefinitionsFromTools(requestParsed.tools);
};
