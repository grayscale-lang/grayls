// Static EZ language data: keywords, types, builtins, stdlib modules, and hover docs.
// Source of truth: EZ STANDARD.md

export const KEYWORDS: string[] = [
  // Control flow
  'as_long_as', 'break', 'continue', 'default', 'ensure', 'for', 'for_each',
  'if', 'is', 'loop', 'or', 'or_return', 'otherwise', 'return', 'when', 'while',
  // Declarations
  'const', 'do', 'enum', 'import', 'mut', 'new', 'private', 'struct', 'use', 'using',
  // Operators / values
  'cast', 'false', 'in', 'not_in', 'nil', 'range', 'true',
];

export const TYPES: string[] = [
  // Primitive
  'bool', 'byte', 'char', 'Error', 'float', 'func', 'int', 'map', 'string', 'uint',
  // Sized integers
  'i8', 'i16', 'i32', 'i64', 'i128', 'i256',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
  // Sized floats
  'f32', 'f64',
];

export const BUILTINS: string[] = [
  // Output
  'println', 'print', 'eprintln', 'eprint',
  // Input
  'input',
  // Collections / memory
  'len', 'copy', 'new', 'ref', 'addr',
  // Type utilities
  'type_of', 'size_of', 'cast',
  // String utilities
  'to_char', 'char_count', 'c_string',
  // Error / control
  'error', 'assert', 'panic', 'exit',
  // Range
  'range',
  // Wide integer constructors
  'i128', 'i256', 'u128', 'u256',
  // Compile-time
  'embed',
  // Sleep
  'sleep_s', 'sleep_ms', 'sleep_ns',
  // Type conversion functions (also serve as cast)
  'int', 'uint', 'float', 'string', 'bool',
];

export const STDLIB_MODULES: string[] = [
  'arrays', 'strings', 'maps', 'math', 'time', 'random',
  'json', 'io', 'os', 'http', 'crypto', 'encoding',
  'uuid', 'bytes', 'binary', 'sqlite', 'server', 'regex', 'csv',
];

// ---------------------------------------------------------------------------
// Stdlib module → function docs
// Key format: "module.function"  (e.g. "arrays.append")
// ---------------------------------------------------------------------------

export const MODULE_FUNCTION_DOCS: Record<string, string> = {
  // @arrays
  'arrays.is_empty':    '**`arrays.is_empty(arr [T]) -> bool`** — Check if array is empty.',
  'arrays.contains':    '**`arrays.contains(arr [T], value T) -> bool`** — Check if value exists in array.',
  'arrays.index_of':    '**`arrays.index_of(arr [T], value T) -> int`** — First index of value, or -1 if not found.',
  'arrays.count':       '**`arrays.count(arr [T], value T) -> int`** — Count occurrences of value.',
  'arrays.is_equal':    '**`arrays.is_equal(a [T], b [T]) -> bool`** — Structural equality (use instead of `==`).',
  'arrays.get_first':   '**`arrays.get_first(arr [T]) -> T`** — Return first element (panics if empty).',
  'arrays.get_last':    '**`arrays.get_last(arr [T]) -> T`** — Return last element (panics if empty).',
  'arrays.append':      '**`arrays.append(&arr [T], value T)`** — Append an element to the end of the array.',
  'arrays.prepend':     '**`arrays.prepend(&arr [T], value T)`** — Insert value at the front.',
  'arrays.insert_at':   '**`arrays.insert_at(&arr [T], index int, value T)`** — Insert value at index.',
  'arrays.remove':      '**`arrays.remove(&arr [T], value T)`** — Remove first occurrence of value.',
  'arrays.remove_at':   '**`arrays.remove_at(&arr [T], index int)`** — Remove element at index.',
  'arrays.remove_first':'**`arrays.remove_first(&arr [T]) -> T`** — Remove and return first element.',
  'arrays.remove_last': '**`arrays.remove_last(&arr [T]) -> T`** — Remove and return last element.',
  'arrays.clear':       '**`arrays.clear(&arr [T])`** — Remove all elements.',
  'arrays.fill':        '**`arrays.fill(&arr [T], value T, count int)`** — Fill array with N copies of value.',
  'arrays.sort_asc':    '**`arrays.sort_asc(&arr [T])`** — Sort ascending in-place.',
  'arrays.sort_desc':   '**`arrays.sort_desc(&arr [T])`** — Sort descending in-place.',
  'arrays.reverse':     '**`arrays.reverse(arr [T]) -> [T]`** — Return a reversed copy.',
  'arrays.slice':       '**`arrays.slice(arr [T], start int, end int) -> [T]`** — Return a slice.',
  'arrays.concat':      '**`arrays.concat(a [T], b [T]) -> [T]`** — Concatenate two arrays.',
  'arrays.deduplicate': '**`arrays.deduplicate(arr [T]) -> [T]`** — Remove duplicate values.',
  'arrays.flatten':     '**`arrays.flatten(arr [[T]]) -> [T]`** — Flatten one level of nesting.',
  'arrays.split_every': '**`arrays.split_every(arr [T], size int) -> [[T]]`** — Split into sub-arrays of given size.',
  'arrays.pair':        '**`arrays.pair(a [T], b [T]) -> [[T]]`** — Pair elements from two arrays.',
  'arrays.get_sum':     '**`arrays.get_sum(arr [T]) -> T`** — Sum all elements.',
  'arrays.get_min':     '**`arrays.get_min(arr [T]) -> T`** — Minimum element.',
  'arrays.get_max':     '**`arrays.get_max(arr [T]) -> T`** — Maximum element.',
  'arrays.map':         '**`arrays.map(arr [T], transform) -> [T]`** — Return new array with transform applied to each element.',
  'arrays.filter':      '**`arrays.filter(arr [T], predicate) -> [T]`** — Return elements for which predicate returns true.',
  'arrays.reduce':      '**`arrays.reduce(arr [T], initial T, accumulator) -> T`** — Reduce array to a single value.',

  // @strings
  'strings.to_upper':    '**`strings.to_upper(s string) -> string`** — Convert to uppercase.',
  'strings.to_lower':    '**`strings.to_lower(s string) -> string`** — Convert to lowercase.',
  'strings.is_empty':    '**`strings.is_empty(s string) -> bool`** — Check if string is empty (zero length).',
  'strings.contains':    '**`strings.contains(s string, sub string) -> bool`** — Check if string contains substring.',
  'strings.starts_with': '**`strings.starts_with(s string, prefix string) -> bool`** — Check if string starts with prefix.',
  'strings.ends_with':   '**`strings.ends_with(s string, suffix string) -> bool`** — Check if string ends with suffix.',
  'strings.index_of':    '**`strings.index_of(s string, sub string) -> int`** — First index of substring.',
  'strings.count':       '**`strings.count(s string, sub string) -> int`** — Count occurrences of substring.',
  'strings.is_alpha':    '**`strings.is_alpha(c char) -> bool`** — True if c is an ASCII letter (a-z, A-Z).',
  'strings.is_digit':    '**`strings.is_digit(c char) -> bool`** — True if c is a decimal digit (0-9).',
  'strings.is_alnum':    '**`strings.is_alnum(c char) -> bool`** — True if c is a letter or digit.',
  'strings.is_whitespace':'**`strings.is_whitespace(c char) -> bool`** — True if c is space, tab, newline, or CR.',
  'strings.is_upper':    '**`strings.is_upper(c char) -> bool`** — True if c is an uppercase letter.',
  'strings.is_lower':    '**`strings.is_lower(c char) -> bool`** — True if c is a lowercase letter.',
  'strings.trim':        '**`strings.trim(s string) -> string`** — Trim leading and trailing whitespace.',
  'strings.trim_left':   '**`strings.trim_left(s string) -> string`** — Trim leading whitespace.',
  'strings.trim_right':  '**`strings.trim_right(s string) -> string`** — Trim trailing whitespace.',
  'strings.replace':     '**`strings.replace(s string, old string, new string) -> string`** — Replace all occurrences.',
  'strings.repeat':      '**`strings.repeat(s string, count int) -> string`** — Repeat string N times.',
  'strings.reverse':     '**`strings.reverse(s string) -> string`** — Reverse string.',
  'strings.split':       '**`strings.split(s string, sep string) -> [string]`** — Split string by separator.',
  'strings.join':        '**`strings.join(arr [string], sep string) -> string`** — Join array of strings with separator.',
  'strings.slice':       '**`strings.slice(s string, start int, end int) -> string`** — Extract substring by byte index.',

  // @maps
  'maps.is_empty':        '**`maps.is_empty(m map[K:V]) -> bool`** — Check if map is empty.',
  'maps.has_key':         '**`maps.has_key(m map[K:V], key K) -> bool`** — Check if key exists.',
  'maps.contains_value':  '**`maps.contains_value(m map[K:V], value V) -> bool`** — Check if any entry has the given value.',
  'maps.get_keys':        '**`maps.get_keys(m map[K:V]) -> [K]`** — Get all keys as an array.',
  'maps.get_values':      '**`maps.get_values(m map[K:V]) -> [V]`** — Get all values as an array.',
  'maps.get_or_default':  '**`maps.get_or_default(m map[K:V], key K, default V) -> V`** — Get value or return default if key missing.',
  'maps.remove_key':      '**`maps.remove_key(&m map[K:V], key K) -> bool`** — Remove key-value pair.',
  'maps.clear':           '**`maps.clear(&m map[K:V])`** — Remove all entries.',
  'maps.merge':           '**`maps.merge(m1 map[K:V], m2 map[K:V]) -> map[K:V]`** — Combine two maps (m2 overwrites on conflict).',
  'maps.is_equal':        '**`maps.is_equal(a map[K:V], b map[K:V]) -> bool`** — Structural equality (use instead of `==`).',

  // @math
  'math.abs':       '**`math.abs(n T) -> T`** — Absolute value.',
  'math.neg':       '**`math.neg(n T) -> T`** — Negation.',
  'math.sign':      '**`math.sign(n T) -> int`** — Sign: -1, 0, or 1.',
  'math.min':       '**`math.min(a T, b T) -> T`** — Minimum of two values.',
  'math.max':       '**`math.max(a T, b T) -> T`** — Maximum of two values.',
  'math.clamp':     '**`math.clamp(value T, min T, max T) -> T`** — Clamp value to range [min, max].',
  'math.floor':     '**`math.floor(n T) -> float`** — Round down to nearest integer.',
  'math.ceil':      '**`math.ceil(n T) -> float`** — Round up to nearest integer.',
  'math.round':     '**`math.round(n T) -> float`** — Round to nearest integer.',
  'math.trunc':     '**`math.trunc(n T) -> float`** — Truncate toward zero.',
  'math.pow':       '**`math.pow(base T, exp T) -> float`** — Raise base to exponent.',
  'math.sqrt':      '**`math.sqrt(n T) -> float`** — Square root.',
  'math.cbrt':      '**`math.cbrt(n T) -> float`** — Cube root.',
  'math.hypot':     '**`math.hypot(x T, y T) -> float`** — Hypotenuse: sqrt(x² + y²).',
  'math.exp':       '**`math.exp(n T) -> float`** — e raised to the power n.',
  'math.exp2':      '**`math.exp2(n T) -> float`** — 2 raised to the power n.',
  'math.log':       '**`math.log(n T) -> float`** — Natural logarithm.',
  'math.log2':      '**`math.log2(n T) -> float`** — Base-2 logarithm.',
  'math.log10':     '**`math.log10(n T) -> float`** — Base-10 logarithm.',
  'math.log_base':  '**`math.log_base(value T, base T) -> float`** — Logarithm with custom base.',
  'math.sin':       '**`math.sin(rad T) -> float`** — Sine (radians).',
  'math.cos':       '**`math.cos(rad T) -> float`** — Cosine (radians).',
  'math.tan':       '**`math.tan(rad T) -> float`** — Tangent (radians).',
  'math.asin':      '**`math.asin(n T) -> float`** — Arc sine.',
  'math.acos':      '**`math.acos(n T) -> float`** — Arc cosine.',
  'math.atan':      '**`math.atan(n T) -> float`** — Arc tangent.',
  'math.atan2':     '**`math.atan2(y T, x T) -> float`** — Arc tangent of y/x.',
  'math.sinh':      '**`math.sinh(n T) -> float`** — Hyperbolic sine.',
  'math.cosh':      '**`math.cosh(n T) -> float`** — Hyperbolic cosine.',
  'math.tanh':      '**`math.tanh(n T) -> float`** — Hyperbolic tangent.',
  'math.deg_to_rad':'**`math.deg_to_rad(deg T) -> float`** — Convert degrees to radians.',
  'math.rad_to_deg':'**`math.rad_to_deg(rad T) -> float`** — Convert radians to degrees.',
  'math.factorial': '**`math.factorial(n int) -> int`** — Factorial (n must be non-negative).',
  'math.gcd':       '**`math.gcd(a int, b int) -> int`** — Greatest common divisor.',
  'math.lcm':       '**`math.lcm(a int, b int) -> int`** — Least common multiple.',
  'math.is_prime':  '**`math.is_prime(n int) -> bool`** — Check if number is prime.',
  'math.is_even':   '**`math.is_even(n int) -> bool`** — Check if number is even.',
  'math.is_odd':    '**`math.is_odd(n int) -> bool`** — Check if number is odd.',
  'math.is_infinite':'**`math.is_infinite(n float) -> bool`** — Check if value is infinite.',
  'math.is_nan':    '**`math.is_nan(n float) -> bool`** — Check if value is NaN.',
  'math.is_finite': '**`math.is_finite(n float) -> bool`** — Check if value is finite (not infinite or NaN).',
  'math.lerp':      '**`math.lerp(a T, b T, t T) -> float`** — Linear interpolation between a and b by factor t.',
  'math.distance':  '**`math.distance(x1 T, y1 T, x2 T, y2 T) -> float`** — Euclidean distance between two 2D points.',

  // @time
  'time.now':        '**`time.now() -> int`** — Current Unix timestamp in seconds.',
  'time.now_ms':     '**`time.now_ms() -> int`** — Current Unix timestamp in milliseconds.',
  'time.now_ns':     '**`time.now_ns() -> int`** — Current Unix timestamp in nanoseconds.',
  'time.year':       '**`time.year(timestamp int) -> int`** — Get year from Unix timestamp.',
  'time.month':      '**`time.month(timestamp int) -> int`** — Get month (1–12) from Unix timestamp.',
  'time.day':        '**`time.day(timestamp int) -> int`** — Get day of month from Unix timestamp.',
  'time.hour':       '**`time.hour(timestamp int) -> int`** — Get hour from Unix timestamp.',
  'time.minute':     '**`time.minute(timestamp int) -> int`** — Get minute from Unix timestamp.',
  'time.second':     '**`time.second(timestamp int) -> int`** — Get second from Unix timestamp.',
  'time.weekday':    '**`time.weekday(timestamp int) -> int`** — Get day of week (0=Sunday).',
  'time.format':     '**`time.format(format string, timestamp int) -> string`** — Format timestamp with a format string.',
  'time.to_iso':     '**`time.to_iso(timestamp int) -> string`** — Format as ISO 8601 string.',
  'time.date':       '**`time.date(timestamp int) -> string`** — Format as YYYY-MM-DD.',
  'time.to_clock':   '**`time.to_clock(timestamp int) -> string`** — Format as HH:MM:SS.',
  'time.tick':       '**`time.tick() -> int`** — High-resolution timestamp in nanoseconds (for performance timing).',
  'time.elapsed_ms': '**`time.elapsed_ms(start_tick int) -> int`** — Milliseconds elapsed since a `time.tick()` call.',

  // @random
  'random.rand_float':  '**`random.rand_float() -> float`** — Random float in [0.0, 1.0).\n\n**`random.rand_float(min float, max float) -> float`** — Random float in [min, max).',
  'random.rand_int':    '**`random.rand_int(max int) -> int`** — Random int in [0, max).\n\n**`random.rand_int(min int, max int) -> int`** — Random int in [min, max).',
  'random.rand_bool':   '**`random.rand_bool() -> bool`** — Random boolean.',
  'random.rand_byte':   '**`random.rand_byte() -> byte`** — Random byte in [0, 255].',
  'random.rand_char':   '**`random.rand_char() -> char`** — Random printable char.\n\n**`random.rand_char(min char, max char) -> char`** — Random char in range.',
  'random.random_hex':  '**`random.random_hex(length int) -> string`** — Cryptographically secure random hex string.',
  'random.choice':      '**`random.choice(arr [T]) -> T`** — Random element from array.',
  'random.shuffle':     '**`random.shuffle(arr [T]) -> [T]`** — Return shuffled copy of array.',
  'random.sample':      '**`random.sample(arr [T], n int) -> [T]`** — Return n unique random elements.',
  'random.seed':        '**`random.seed(value int)`** — Seed the random number generator.',

  // @io
  'io.read_file':    '**`io.read_file(path string) -> string`** — Read entire file contents.',
  'io.write_file':   '**`io.write_file(path string, content string)`** — Write content to file (overwrite).',
  'io.append_file':  '**`io.append_file(path string, content string)`** — Append content to file.',
  'io.read_lines':   '**`io.read_lines(path string) -> [string]`** — Read file as array of lines.',
  'io.exists':       '**`io.exists(path string) -> bool`** — Check if file or directory exists.',
  'io.delete':       '**`io.delete(path string)`** — Delete a file.',
  'io.copy':         '**`io.copy(src string, dst string)`** — Copy a file.',
  'io.move':         '**`io.move(src string, dst string)`** — Move/rename a file.',
  'io.mkdir':        '**`io.mkdir(path string)`** — Create directory (and parents).',

  // @os
  'os.env':       '**`os.env(name string) -> string`** — Get environment variable value.',
  'os.args':      '**`os.args() -> [string]`** — Command-line arguments.',
  'os.hostname':  '**`os.hostname() -> string`** — Hostname of the current machine.',
  'os.platform':  '**`os.platform() -> string`** — Operating system platform string.',
  'os.cwd':       '**`os.cwd() -> string`** — Current working directory.',
  'os.list_dir':  '**`os.list_dir(path string) -> [string]`** — List directory entries.',

  // @json
  'json.encode':     '**`json.encode(value T) -> string`** — Encode a struct or value to a JSON string.',
  'json.decode':     '**`json.decode(data string, Type) -> Type`** — Decode a JSON string into a struct.',

  // @uuid
  'uuid.v4':       '**`uuid.v4() -> string`** — Generate a random UUID v4.',
  'uuid.v7':       '**`uuid.v7() -> string`** — Generate a time-ordered UUID v7.',
  'uuid.nil':      '**`uuid.nil() -> string`** — Return the nil UUID (all zeros).',
  'uuid.is_valid': '**`uuid.is_valid(s string) -> bool`** — Validate a UUID string.',

  // @regex
  'regex.match':     '**`regex.match(pattern string, s string) -> bool`** — Check if string matches pattern.',
  'regex.find_all':  '**`regex.find_all(pattern string, s string) -> [string]`** — Find all matches.',
  'regex.replace':   '**`regex.replace(pattern string, s string, replacement string) -> string`** — Replace matches.',

  // @crypto
  'crypto.sha256':       '**`crypto.sha256(data string) -> string`** — SHA-256 hash (hex string).',
  'crypto.md5':          '**`crypto.md5(data string) -> string`** — MD5 hash (hex string).',
  'crypto.hmac_sha256':  '**`crypto.hmac_sha256(key string, data string) -> string`** — HMAC-SHA256 (hex string).',
  'crypto.bcrypt_hash':  '**`crypto.bcrypt_hash(password string) -> string`** — Bcrypt hash of password.',
  'crypto.bcrypt_verify':'**`crypto.bcrypt_verify(password string, hash string) -> bool`** — Verify bcrypt password.',

  // @encoding
  'encoding.base64_encode': '**`encoding.base64_encode(s string) -> string`** — Encode to Base64.',
  'encoding.base64_decode': '**`encoding.base64_decode(s string) -> string`** — Decode from Base64.',
  'encoding.hex_encode':    '**`encoding.hex_encode(s string) -> string`** — Encode to hex string.',
  'encoding.hex_decode':    '**`encoding.hex_decode(s string) -> string`** — Decode from hex string.',
};

// ---------------------------------------------------------------------------
// Hover documentation
// ---------------------------------------------------------------------------

export const DOCS: Record<string, string> = {
  // --- Keywords ---
  'mut': '**`mut`** — Declares a mutable variable.\n\n```ez\nmut x int = 42\nmut name string = "hello"\n```',
  'const': '**`const`** — Declares an immutable constant or a named struct/enum type.\n\n```ez\nconst PI float = 3.14159\nconst Point struct { x int; y int }\n```',
  'if': '**`if`** — Conditional branch. Branches on a boolean expression.\n\n```ez\nif x > 10 {\n    println("big")\n} otherwise {\n    println("small")\n}\n```',
  'otherwise': '**`otherwise`** — The else branch of an `if` or `when` statement.',
  'when': '**`when`** — Pattern-matching switch. Compares a value against a list of cases.\n\n```ez\nwhen x is {\n    1 { println("one") }\n    2 { println("two") }\n    default { println("other") }\n}\n```',
  'is': '**`is`** — Used inside `when` to introduce the match body.',
  'default': '**`default`** — The fallback arm of a `when` expression.',
  'for': '**`for`** — C-style indexed loop.\n\n```ez\nfor mut i int = 0; i < 10; i++ {\n    println(i)\n}\n```',
  'for_each': '**`for_each`** — Iterates over every element of a collection.\n\n```ez\nfor_each item in items {\n    println(item)\n}\n```',
  'while': '**`while`** — Loop that runs while a condition is true.\n\n```ez\nwhile x > 0 {\n    x--\n}\n```',
  'as_long_as': '**`as_long_as`** — Alias for `while`. Runs the body as long as the condition holds.',
  'loop': '**`loop`** — Infinite loop. Use `break` to exit.\n\n```ez\nloop {\n    if done { break }\n}\n```',
  'break': '**`break`** — Exits the innermost loop.',
  'continue': '**`continue`** — Skips to the next iteration of the innermost loop.',
  'return': '**`return`** — Returns a value from a function.\n\n```ez\nfunc add(a int, b int) -> int {\n    return a + b\n}\n```',
  'do': '**`do`** — Declares the `main` entry-point function (and any function without a return type).\n\n```ez\ndo main() {\n    println("Hello, EZ!")\n}\n```',
  'func': '**`func`** — Declares a function with a return type.\n\n```ez\nfunc add(a int, b int) -> int {\n    return a + b\n}\n```',
  'struct': '**`struct`** — Declares a user-defined composite type.\n\n```ez\nconst Point struct {\n    x int\n    y int\n}\n```',
  'enum': '**`enum`** — Declares a set of named constants.\n\n```ez\nconst Direction enum {\n    NORTH\n    EAST\n    SOUTH\n    WEST\n}\n```',
  'import': '**`import`** — Imports a standard library module.\n\n```ez\nimport @math\nimport @io\n```',
  'using': '**`using`** — Imports a module\'s symbols into the current scope.\n\n```ez\nimport @math using *\n```',
  'use': '**`use`** — Used with `import` to bring symbols into scope.',
  'new': '**`new`** — Allocates a zero-initialized struct on the arena and returns a pointer.\n\n```ez\nmut p ^Point = new(Point)\n```',
  'private': '**`private`** — Restricts visibility of a function or declaration to the current file.',
  'cast': '**`cast`** — Explicit type conversion.\n\n```ez\nmut n i32 = cast(myInt, i32)\n```',
  'in': '**`in`** — Tests membership in a collection.\n\n```ez\nif 5 in numbers { println("found") }\n```',
  'not_in': '**`not_in`** — Tests non-membership in a collection.\n\n```ez\nif 5 not_in numbers { println("missing") }\n```',
  'range': '**`range`** — Creates an integer range for iteration.\n\n```ez\nfor_each i in range(0, 10) { println(i) }\nfor_each i in range(0, 10, 2) { println(i) }  // step 2\n```',
  'or': '**`or`** — Error-propagation operator. If the left side is an Error, executes the right side.\n\n```ez\nmut val = risky() or { return }\n```',
  'or_return': '**`or_return`** — Returns early if the expression is an Error.',
  'ensure': '**`ensure`** — Deferred cleanup block. Runs when the surrounding scope exits.\n\n```ez\nensure { cleanup() }\n```',
  'true': '**`true`** — Boolean literal representing the true value.',
  'false': '**`false`** — Boolean literal representing the false value.',
  'nil': '**`nil`** — Represents the absence of a value (null pointer).',

  // --- Types ---
  'int': '**`int`** — 64-bit signed integer. Range: -2⁶³ to 2⁶³-1. Overflow-checked at runtime.\n\n```ez\nmut x int = 42\n```',
  'uint': '**`uint`** — 64-bit unsigned integer. Range: 0 to 2⁶⁴-1. Overflow-checked at runtime.\n\n```ez\nmut count uint = 100\n```',
  'float': '**`float`** — 64-bit IEEE 754 double-precision floating-point.\n\n```ez\nmut pi float = 3.14159\n```',
  'string': '**`string`** — UTF-8 encoded byte sequence. `len()` returns byte length; use `char_count()` for character count.\n\n```ez\nmut s string = "hello"\n```',
  'bool': '**`bool`** — Boolean type. Values: `true` or `false`.',
  'char': '**`char`** — Single character. Convertible to `int` codepoint via `int(c)`.',
  'byte': '**`byte`** — 8-bit unsigned integer (0–255). Useful for raw binary data.',
  'Error': '**`Error`** — Error type returned from functions that can fail. Create with `error("message")`.',
  'map': '**`map`** — Unordered key-value collection.\n\n```ez\nmut ages map[string:int] = {"alice": 30}\n```',
  'i8': '**`i8`** — 8-bit signed integer. Range: -128 to 127.',
  'i16': '**`i16`** — 16-bit signed integer. Range: -32,768 to 32,767.',
  'i32': '**`i32`** — 32-bit signed integer. Range: -2³¹ to 2³¹-1.',
  'i64': '**`i64`** — 64-bit signed integer. Same as `int` but explicitly sized.',
  'i128': '**`i128`** — 128-bit signed integer (struct-based). Construct with `i128(value)`.',
  'i256': '**`i256`** — 256-bit signed integer (struct-based). Construct with `i256(value)`.',
  'u8': '**`u8`** — 8-bit unsigned integer. Range: 0 to 255.',
  'u16': '**`u16`** — 16-bit unsigned integer. Range: 0 to 65,535.',
  'u32': '**`u32`** — 32-bit unsigned integer. Range: 0 to 2³²-1.',
  'u64': '**`u64`** — 64-bit unsigned integer. Same as `uint` but explicitly sized.',
  'u128': '**`u128`** — 128-bit unsigned integer (struct-based). Construct with `u128(value)`.',
  'u256': '**`u256`** — 256-bit unsigned integer (struct-based). Construct with `u256(value)`.',
  'f32': '**`f32`** — 32-bit IEEE 754 single-precision floating-point.',
  'f64': '**`f64`** — 64-bit IEEE 754 double-precision floating-point. Equivalent to `float`.',

  // --- Builtins ---
  'println': '**`println(value)`** — Prints a value followed by a newline. Accepts any type.',
  'print': '**`print(value)`** — Prints a value without a trailing newline. Accepts any type.',
  'eprintln': '**`eprintln(value)`** — Prints a value to stderr with a newline.',
  'eprint': '**`eprint(value)`** — Prints a value to stderr without a newline.',
  'input': '**`input() -> string`** — Reads a line from stdin and returns it as a string.',
  'len': '**`len(collection) -> int`** — Returns the length of an array, map, or string (byte length for strings).',
  'type_of': '**`type_of(value) -> string`** — Returns the EZ type name as a string (e.g. `"int"`, `"string"`).',
  'size_of': '**`size_of(Type) -> int`** — Returns the size of a type in bytes.',
  'copy': '**`copy(value) -> T`** — Creates a deep copy of any value.',
  'ref': '**`ref(variable) -> ref<T>`** — Creates a transparent reference (alias) to a variable.',
  'addr': '**`addr(variable) -> ^T`** — Returns the memory address of a variable as a pointer.',
  'error': '**`error(message string) -> Error`** — Creates an Error value with the given message.',
  'assert': '**`assert(condition bool, message string)`** — Panics with message if condition is false.',
  'panic': '**`panic(message string)`** — Terminates the program immediately with an error message.',
  'exit': '**`exit(code int)`** — Exits the program with the given status code.',
  'to_char': '**`to_char(s string, index int) -> int`** — Returns the Unicode codepoint at character position `index`.',
  'char_count': '**`char_count(s string) -> int`** — Returns the number of Unicode characters (not bytes) in a string.',
  'c_string': '**`c_string(ptr ^u8) -> string`** — Converts a C `char*` pointer to an EZ string (C interop).',
  'embed': '**`embed(path string) -> string`** — Reads a file at compile time and bakes its contents into the binary.',
  'sleep_s': '**`sleep_s(seconds int)`** — Sleeps for the given number of seconds.',
  'sleep_ms': '**`sleep_ms(ms int)`** — Sleeps for the given number of milliseconds.',
  'sleep_ns': '**`sleep_ns(ns int)`** — Sleeps for the given number of nanoseconds.',

  // --- Stdlib modules ---
  'arrays': '**`@arrays`** — Standard array utilities: `append`, `pop`, `remove`, `contains`, `reverse`, `sort`, `find`, `slice`, `flatten`, etc.',
  'strings': '**`@strings`** — String manipulation: `split`, `join`, `trim`, `contains`, `starts_with`, `ends_with`, `replace`, `to_upper`, `to_lower`, etc.',
  'maps': '**`@maps`** — Map utilities: `keys`, `values`, `contains_key`, `delete`, `merge`, etc.',
  'math': '**`@math`** — Math functions: `abs`, `sqrt`, `pow`, `log`, `sin`, `cos`, `tan`, `ceil`, `floor`, `round`, `min`, `max`, `clamp`, etc.',
  'time': '**`@time`** — Time utilities: `now`, `since`, `format`, `parse`, `unix`, `duration`, etc.',
  'random': '**`@random`** — Random number generation: `int`, `float`, `seed`, `choice`, etc.',
  'json': '**`@json`** — JSON encoding/decoding.',
  'io': '**`@io`** — File and stream I/O: `read_file`, `write_file`, `append_file`, `read_lines`, `exists`, `delete`, `copy`, `move`, `mkdir`, etc.',
  'os': '**`@os`** — OS interaction: `env`, `args`, `hostname`, `platform`, `cwd`, `list_dir`, `stat`, etc.',
  'http': '**`@http`** — HTTP client: `get`, `post`, `put`, `delete`, `request`, with response type.',
  'crypto': '**`@crypto`** — Cryptographic functions: `sha256`, `md5`, `hmac_sha256`, `bcrypt_hash`, `bcrypt_verify`, etc.',
  'encoding': '**`@encoding`** — Base64 and hex encoding/decoding.',
  'uuid': '**`@uuid`** — UUID generation: `v4`, `v7`, `nil`, `is_valid`, etc.',
  'bytes': '**`@bytes`** — Byte slice operations.',
  'binary': '**`@binary`** — Binary read/write: little-endian and big-endian integer I/O.',
  'sqlite': '**`@sqlite`** — SQLite database access.',
  'server': '**`@server`** — HTTP server: routing, middleware, handlers.',
  'regex': '**`@regex`** — Regular expression matching: `match`, `find_all`, `replace`, etc.',
  'csv': '**`@csv`** — CSV parsing and writing.',
};
