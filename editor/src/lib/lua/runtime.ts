// ═══════════════════════════════════════════════════════════════════════════
// Lua Runtime - Fengari-based Lua interpreter for the editor
// ═══════════════════════════════════════════════════════════════════════════

import { lua, lauxlib, lualib, to_luastring } from 'fengari-web';

export interface LuaValue {
  type: 'nil' | 'boolean' | 'number' | 'string' | 'table' | 'function';
  value: unknown;
}

export class LuaRuntime {
  private L: any;
  private initialized = false;

  constructor() {
    this.L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.L);
    this.initialized = true;
  }

  /**
   * Execute Lua code and return the result
   */
  execute(code: string): LuaValue | null {
    if (!this.initialized) return null;

    const status = lauxlib.luaL_dostring(this.L, to_luastring(code));

    if (status !== lua.LUA_OK) {
      const error = lua.lua_tojsstring(this.L, -1);
      lua.lua_pop(this.L, 1);
      throw new Error(`Lua error: ${error}`);
    }

    // Get the return value if any
    if (lua.lua_gettop(this.L) > 0) {
      const result = this.toJS(-1);
      lua.lua_pop(this.L, 1);
      return result;
    }

    return null;
  }

  /**
   * Load a Lua file (as string content)
   */
  loadFile(content: string, filename: string = 'chunk'): void {
    const status = lauxlib.luaL_loadbuffer(
      this.L,
      to_luastring(content),
      null,
      to_luastring(filename)
    );

    if (status !== lua.LUA_OK) {
      const error = lua.lua_tojsstring(this.L, -1);
      lua.lua_pop(this.L, 1);
      throw new Error(`Lua load error: ${error}`);
    }

    // Execute the loaded chunk
    const callStatus = lua.lua_pcall(this.L, 0, lua.LUA_MULTRET, 0);
    if (callStatus !== lua.LUA_OK) {
      const error = lua.lua_tojsstring(this.L, -1);
      lua.lua_pop(this.L, 1);
      throw new Error(`Lua execution error: ${error}`);
    }
  }

  /**
   * Set a global variable
   */
  setGlobal(name: string, value: unknown): void {
    this.pushValue(value);
    lua.lua_setglobal(this.L, to_luastring(name));
  }

  /**
   * Get a global variable
   */
  getGlobal(name: string): LuaValue | null {
    lua.lua_getglobal(this.L, to_luastring(name));
    const result = this.toJS(-1);
    lua.lua_pop(this.L, 1);
    return result;
  }

  /**
   * Register a JavaScript function as a Lua function
   */
  registerFunction(name: string, fn: (...args: unknown[]) => unknown): void {
    const wrapper = (L: any) => {
      const nargs = lua.lua_gettop(L);
      const args: unknown[] = [];

      for (let i = 1; i <= nargs; i++) {
        const val = this.toJSAt(i);
        args.push(val?.value);
      }

      try {
        const result = fn(...args);
        this.pushValue(result);
        return 1;
      } catch (e) {
        lua.lua_pushstring(L, to_luastring(String(e)));
        return lua.lua_error(L);
      }
    };

    lua.lua_pushcfunction(this.L, wrapper);
    lua.lua_setglobal(this.L, to_luastring(name));
  }

  /**
   * Register an object with methods as a Lua table
   */
  registerModule(name: string, methods: Record<string, (...args: unknown[]) => unknown>): void {
    lua.lua_newtable(this.L);

    for (const [methodName, fn] of Object.entries(methods)) {
      const wrapper = (L: any) => {
        const nargs = lua.lua_gettop(L);
        const args: unknown[] = [];

        for (let i = 1; i <= nargs; i++) {
          const val = this.toJSAt(i);
          args.push(val?.value);
        }

        try {
          const result = fn(...args);
          this.pushValue(result);
          return 1;
        } catch (e) {
          lua.lua_pushstring(L, to_luastring(String(e)));
          return lua.lua_error(L);
        }
      };

      lua.lua_pushstring(this.L, to_luastring(methodName));
      lua.lua_pushcfunction(this.L, wrapper);
      lua.lua_settable(this.L, -3);
    }

    lua.lua_setglobal(this.L, to_luastring(name));
  }

  /**
   * Convert Lua value at stack index to JavaScript
   */
  private toJSAt(index: number): LuaValue | null {
    const type = lua.lua_type(this.L, index);

    switch (type) {
      case lua.LUA_TNIL:
        return { type: 'nil', value: null };

      case lua.LUA_TBOOLEAN:
        return { type: 'boolean', value: lua.lua_toboolean(this.L, index) };

      case lua.LUA_TNUMBER:
        return { type: 'number', value: lua.lua_tonumber(this.L, index) };

      case lua.LUA_TSTRING:
        return { type: 'string', value: lua.lua_tojsstring(this.L, index) };

      case lua.LUA_TTABLE:
        return { type: 'table', value: this.tableToJS(index) };

      case lua.LUA_TFUNCTION:
        return { type: 'function', value: '[function]' };

      default:
        return null;
    }
  }

  private toJS(index: number): LuaValue | null {
    return this.toJSAt(index);
  }

  /**
   * Convert Lua table to JavaScript object/array
   */
  private tableToJS(index: number): Record<string, unknown> | unknown[] {
    const result: Record<string, unknown> = {};
    let isArray = true;
    let maxIndex = 0;

    // Normalize index
    if (index < 0) {
      index = lua.lua_gettop(this.L) + index + 1;
    }

    lua.lua_pushnil(this.L);
    while (lua.lua_next(this.L, index) !== 0) {
      const keyType = lua.lua_type(this.L, -2);
      let key: string | number;

      if (keyType === lua.LUA_TNUMBER) {
        key = lua.lua_tonumber(this.L, -2);
        if (Number.isInteger(key) && key > 0) {
          maxIndex = Math.max(maxIndex, key as number);
        } else {
          isArray = false;
        }
      } else {
        key = lua.lua_tojsstring(this.L, -2);
        isArray = false;
      }

      const value = this.toJS(-1);
      result[key] = value?.value;

      lua.lua_pop(this.L, 1);
    }

    // Convert to array if all keys are sequential integers
    if (isArray && maxIndex > 0) {
      const arr: unknown[] = [];
      for (let i = 1; i <= maxIndex; i++) {
        arr.push(result[i]);
      }
      return arr;
    }

    return result;
  }

  /**
   * Push JavaScript value onto Lua stack
   */
  private pushValue(value: unknown): void {
    if (value === null || value === undefined) {
      lua.lua_pushnil(this.L);
    } else if (typeof value === 'boolean') {
      lua.lua_pushboolean(this.L, value ? 1 : 0);
    } else if (typeof value === 'number') {
      lua.lua_pushnumber(this.L, value);
    } else if (typeof value === 'string') {
      lua.lua_pushstring(this.L, to_luastring(value));
    } else if (Array.isArray(value)) {
      lua.lua_newtable(this.L);
      value.forEach((item, i) => {
        lua.lua_pushnumber(this.L, i + 1);
        this.pushValue(item);
        lua.lua_settable(this.L, -3);
      });
    } else if (typeof value === 'object') {
      lua.lua_newtable(this.L);
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        lua.lua_pushstring(this.L, to_luastring(k));
        this.pushValue(v);
        lua.lua_settable(this.L, -3);
      }
    } else if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      const wrapper = (L: any) => {
        const nargs = lua.lua_gettop(L);
        const args: unknown[] = [];
        for (let i = 1; i <= nargs; i++) {
          const val = this.toJSAt(i);
          args.push(val?.value);
        }
        const result = fn(...args);
        this.pushValue(result);
        return 1;
      };
      lua.lua_pushcfunction(this.L, wrapper);
    }
  }

  /**
   * Clean up
   */
  close(): void {
    if (this.L) {
      lua.lua_close(this.L);
      this.L = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
let runtimeInstance: LuaRuntime | null = null;

export function getLuaRuntime(): LuaRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new LuaRuntime();
  }
  return runtimeInstance;
}
