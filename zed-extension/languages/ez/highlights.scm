; Identifiers (fallback) - MUST BE FIRST so specific patterns override
(identifier) @variable

; Comments
(comment) @comment
(block_comment) @comment

; Strings
(string) @string
(string_content) @string
(raw_string) @string

; String interpolation - capture the delimiters explicitly
(interpolation
  "${" @string.special
  "}" @string.special)

; Escape sequences
(escape_sequence) @string.escape

; Numbers
(integer) @number
(float) @number

; Booleans
[
  "true"
  "false"
] @constant.builtin

; Nil
(nil) @constant.builtin

; Built-in constants (matched by identifier text since they're not node types)
((identifier) @constant.builtin
  (#match? @constant.builtin "^(EXIT_SUCCESS|EXIT_FAILURE)$"))

; Blank identifier
((identifier) @variable.builtin
  (#eq? @variable.builtin "_"))

; Keywords
[
  "mut"
  "const"
  "do"
  "return"
  "if"
  "or"
  "otherwise"
  "for"
  "for_each"
  "as_long_as"
  "while"
  "loop"
  "in"
  "not_in"
  "range"
  "import"
  "and"
  "using"
  "use"
  "struct"
  "enum"
  "new"
  "when"
  "is"
  "default"
  "module"
  "private"
  "ensure"
  "or_return"
  "cast"
] @keyword

; Bitwise keyword operators
[
  "bit_and"
  "bit_or"
  "bit_xor"
  "bit_not"
  "bit_shift_left"
  "bit_shift_right"
] @keyword.operator

; Break and continue are named nodes
(break_statement) @keyword
(continue_statement) @keyword

; Types - builtin primitives (defined in grammar)
[
  "int"
  "i8"
  "i16"
  "i32"
  "i64"
  "i128"
  "i256"
  "uint"
  "u8"
  "u16"
  "u32"
  "u64"
  "u128"
  "u256"
  "float"
  "f32"
  "f64"
  "bool"
  "char"
  "byte"
  "string"
  "map"
  "func"
] @type.builtin

; Builtin types that are identifiers (runtime/stdlib types)
((identifier) @type.builtin
  (#match? @type.builtin "^(File|Database|Error|HttpResponse|HttpRequest|Thread|Mutex|Channel|Arena|SpinLock|Socket|Listener|Router)$"))

; Type annotations - user defined types
(type (identifier) @type.builtin)

; Type in new() expressions
(new_expression type: (identifier) @type.builtin)

; Operators
[
  "+"
  "-"
  "*"
  "/"
  "%"
  "="
  "=="
  "!="
  "<"
  ">"
  "<="
  ">="
  "&&"
  "||"
  "!"
  "&"
  "^"
  "++"
  "--"
  "+="
  "-="
  "*="
  "/="
  "%="
  "->"
] @operator

; Punctuation - NOTE: } inside interpolation is handled above
[
  "("
  ")"
  "["
  "]"
  "{"
] @punctuation.bracket

; General } - but NOT inside interpolation (handled by query order)
(block "}" @punctuation.bracket)
(array_literal "}" @punctuation.bracket)
(map_literal "}" @punctuation.bracket)
(struct_literal "}" @punctuation.bracket)
(enum_declaration "}" @punctuation.bracket)
(struct_declaration "}" @punctuation.bracket)
(when_statement "}" @punctuation.bracket)

[
  ","
  "."
  ":"
  "#"
] @punctuation.delimiter

; Attributes - use preprocessor/tag color (distinct from functions)
(attribute
  name: (identifier) @tag)

; Import statements
(import_statement) @keyword
(import_and_use_statement) @keyword

; Import paths - stdlib modules with @ prefix
(import_path
  "@" @punctuation.special
  (identifier) @namespace)

; Import alias
(import_statement
  alias: (identifier) @namespace)

; Module declarations (module mymodule)
(module_declaration
  name: (identifier) @namespace)

; Using statements (using std, using arrays)
(using_statement
  (identifier) @namespace)

; Function definitions - function color
(function_declaration
  name: (identifier) @function.definition)

; Struct function definitions (functions inside struct bodies)
(struct_declaration
  (function_declaration
    name: (identifier) @function.definition))

; Built-in function calls
(call_expression
  function: (identifier) @function.builtin
  (#match? @function.builtin "^(len|type_of|copy|error|exit|panic|assert|ref|append|input|read_int|range|addr|println|print|eprintln|eprint|sleep_s|sleep_ms|sleep_ns|to_char|char_count|c_string|i128|u128|i256|u256|size_of)$"))

; cast is a dedicated expression node - highlight keyword portion
(cast_expression
  "cast" @function.builtin)

; Function calls
(call_expression
  function: (identifier) @function.call)

; Function references ()name
(func_ref
  (identifier) @function.call)

; Struct definitions - type color
(struct_declaration
  name: (identifier) @type.definition)

; Enum definitions - type color
(enum_declaration
  name: (identifier) @type.definition)

; Enum values - use constant color (distinct from types)
(enum_value
  (identifier) @constant)

; Variable declarations
(variable_declaration
  (identifier) @variable)

; Named return values
(named_return
  name: (identifier) @variable.parameter)

; Parameters
(parameter
  name: (identifier) @variable.parameter)

; Field declarations in structs - use property color
(field_declaration
  name: (identifier) @variable.member)

; Field access
(member_expression
  property: (identifier) @variable.member)

; Struct field initialization
(struct_field
  (identifier) @variable.member)

; Postfix operators
(postfix_expression
  ["++" "--" "^"] @operator)

; Pointer type caret
(pointer_type
  "^" @operator)

; Wildcard type
(wildcard_type) @type.builtin
