// Type definitions for fengari-web
// Fengari is a Lua 5.3 implementation in JavaScript

declare module 'fengari-web' {
  // Lua string type (Uint8Array)
  type LuaString = Uint8Array;

  // Convert JS string to Lua string
  export function to_luastring(str: string): LuaString;
  export function to_jsstring(str: LuaString): string;

  // Lua state type
  type LuaState = unknown;

  // lua module - core Lua functions
  export const lua: {
    // Constants
    LUA_OK: number;
    LUA_ERRRUN: number;
    LUA_ERRSYNTAX: number;
    LUA_ERRMEM: number;
    LUA_ERRGCMM: number;
    LUA_ERRERR: number;
    LUA_MULTRET: number;

    // Type constants
    LUA_TNIL: number;
    LUA_TBOOLEAN: number;
    LUA_TNUMBER: number;
    LUA_TSTRING: number;
    LUA_TTABLE: number;
    LUA_TFUNCTION: number;
    LUA_TUSERDATA: number;
    LUA_TTHREAD: number;
    LUA_TLIGHTUSERDATA: number;

    // Stack manipulation
    lua_gettop(L: LuaState): number;
    lua_settop(L: LuaState, idx: number): void;
    lua_pop(L: LuaState, n: number): void;
    lua_pushvalue(L: LuaState, idx: number): void;
    lua_remove(L: LuaState, idx: number): void;
    lua_insert(L: LuaState, idx: number): void;
    lua_replace(L: LuaState, idx: number): void;

    // Type checking
    lua_type(L: LuaState, idx: number): number;
    lua_typename(L: LuaState, tp: number): string;
    lua_isnumber(L: LuaState, idx: number): boolean;
    lua_isstring(L: LuaState, idx: number): boolean;
    lua_isfunction(L: LuaState, idx: number): boolean;
    lua_istable(L: LuaState, idx: number): boolean;
    lua_isnil(L: LuaState, idx: number): boolean;
    lua_isboolean(L: LuaState, idx: number): boolean;

    // Value retrieval
    lua_tonumber(L: LuaState, idx: number): number;
    lua_toboolean(L: LuaState, idx: number): boolean;
    lua_tojsstring(L: LuaState, idx: number): string;
    lua_tostring(L: LuaState, idx: number): LuaString;

    // Push values
    lua_pushnil(L: LuaState): void;
    lua_pushnumber(L: LuaState, n: number): void;
    lua_pushboolean(L: LuaState, b: number): void;
    lua_pushstring(L: LuaState, s: LuaString): void;
    lua_pushcfunction(L: LuaState, fn: (L: LuaState) => number): void;

    // Table operations
    lua_newtable(L: LuaState): void;
    lua_createtable(L: LuaState, narr: number, nrec: number): void;
    lua_gettable(L: LuaState, idx: number): number;
    lua_settable(L: LuaState, idx: number): void;
    lua_getfield(L: LuaState, idx: number, k: LuaString): number;
    lua_setfield(L: LuaState, idx: number, k: LuaString): void;
    lua_rawget(L: LuaState, idx: number): number;
    lua_rawset(L: LuaState, idx: number): void;
    lua_next(L: LuaState, idx: number): number;

    // Global table
    lua_getglobal(L: LuaState, name: LuaString): number;
    lua_setglobal(L: LuaState, name: LuaString): void;

    // Function calls
    lua_pcall(L: LuaState, nargs: number, nresults: number, errfunc: number): number;
    lua_call(L: LuaState, nargs: number, nresults: number): void;

    // Error handling
    lua_error(L: LuaState): number;

    // State management
    lua_close(L: LuaState): void;
  };

  // lauxlib module - auxiliary library
  export const lauxlib: {
    luaL_newstate(): LuaState;
    luaL_loadbuffer(L: LuaState, buff: LuaString, size: number | null, name: LuaString): number;
    luaL_loadstring(L: LuaState, s: LuaString): number;
    luaL_dostring(L: LuaState, s: LuaString): number;
    luaL_requiref(L: LuaState, modname: LuaString, openf: (L: LuaState) => number, glb: number): void;
    luaL_ref(L: LuaState, t: number): number;
    luaL_unref(L: LuaState, t: number, ref: number): void;
  };

  // lualib module - standard libraries
  export const lualib: {
    luaL_openlibs(L: LuaState): void;
  };

  // interop module - JavaScript interop
  export const interop: {
    push(L: LuaState, value: unknown): void;
    tojs(L: LuaState, idx: number): unknown;
    checkjs(L: LuaState, idx: number): unknown;
    luaopen_js(L: LuaState): number;
  };

  // Pre-initialized Lua state
  export const L: LuaState;

  // Load and execute Lua source
  export function load(source: string | Uint8Array, chunkname?: string): unknown;
}
