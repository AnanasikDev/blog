---
title: Pentafox Engine
description: Y2A Buas project - Pentafox Game Engine
slug: pentafox
date: 2026-11-04
image: img3.png
coverHeight: full
categories:
    - English
    - Programming
    - Portfolio
tags:
    - English
    - Project
    - Programming
    - C++
    - 3D
---

## Gallery

{{< video src=full_demo_video_w8.mp4 >}}

![Editor](img1.png)
![Themes](img2.png)

![Game, inspector, scene](img3.png)
![Models, asset manager](img4.png)

Unfortunately, I cannot share the project or make github page public, as well as share some code, due to an NDA.

## General overview

Pentafox Engine was written from scratch, based on a close-source XSR (extra small renderer) written by Bojan. It supports:

{{< img src="pentafox.svg" alt="Pentafox logo" width="300" class="img-right" >}}

- Windows and Play Station 5 platforms
- basic rendering
- platform-specific input (keyboard/mouse vs controller)
- dynamic asset management
- OBJ/GLTF/image loading
- asset cooking
- DLL management
- hot DLL reload
- runtime reflection
- serialization (saving, loading, GUI)
- packaging script for windows
- basic hierarchy support
- ECS
- logging with sinks

## Technical detailed overiew

## Entry point

I decided to have the engine entry point as simple as possible, only managing the loop and basic engine stages - init, update, shutdown. After careful consideration and education I decided to switch from calling `shutdown()` explicitly to having RAII destructor be called whenever Engine gets destroyed, automatically.

```cpp
#include <private/engine.hpp>
#include <pentafox/macros.hpp>

int main(int argc, char** argv)
{
    fox::Engine engine;

    const int errcode = engine.init(argc, argv);
    if (errcode != 0)
    {
        FOX_LOG_ERROR("Engine couldn't startup. Error code: ({})", errcode);
        // ~Engine
        return errcode;
    }

    while (!engine.should_close())
    {
        if (engine.update())
        {
            break;
        }
    }

    // ~Engine
    return 0;
}
```

## Game vs Engine vs Editor

The engine is an executable, the game(s) and editor are dynamic libraries loaded at runtime. Whilst I knew that it is a rather difficult approach to take right away, I thought that this architecture is considerably more flexible and reasonable for a game engine, since engine backend is what's going to be running at all time anyway, but games change - I may want to recompile and reload the game at the runtime of the engine, load in more modules, like editor, profiler, other tools. Additionally I immediately saw it is as a great opportunity to finally learn more about shared libraries (which I meant to do for years).

Engine executable also exports a little library stub - it doesn't contain any code, only the exports/imports declarations for address resolution for linker. Originally, I had a single `EngineServices` with a vtable that would get filled in by the engine when the dll is loaded. Then I realized that this approaach is rather limiting and somewhat inefficient, so I decided to make it possible for the engine to export functions so that they can be called directly. This way I don't have to have any vtables and single-access data structures, and instead have a more binding but more easy-to-use architecture.

The engine.hpp:
```cpp
#pragma once

#include <vector>
#include <chrono>
#include <memory>

#include <pentafox/api.hpp>
#include <private/rendering/renderer.hpp>
#include <private/asset_manager/assets.hpp>
#include <private/loader/loader.hpp>
#include <private/rendering/ui.hpp>

namespace fox
{

namespace logging
{
class LogSink;
}  // namespace logging

class Engine // private class, unavailable from external modules, e.g. game or editor
{
public:
    float delta_time = 0.f;
    double time = 0.f;
    float aspect = 1.f;
    long long int frame = 0;
    bool abort_requested = false;

    static Engine* instance; // mostly for services to route calls into the engine

    // API - engine owns all these "systems"
    fox::Assets assets;
    fox::Loader loader;
    fox::logging::LogSink* current_log_sink = nullptr;
    std::unique_ptr<fox::logging::LogSink> log_sink_std;

    // Internal
    fox::Renderer renderer;
    fox::UI ui;

    // explicit rule of 5 - engine should never be copied/moved
    Engine();
    ~Engine(); // instead of shutdown()
    Engine(const Engine& other) = delete;
    Engine(Engine&& other) = delete;
    Engine& operator=(const Engine& other) = delete;
    Engine& operator=(Engine&& other) = delete;

    int init(int argc, char** argv);
    bool update();
    bool should_close() const;
    fox::World* current_world();
    bool current_world(fox::World*& out);
    static void* get_window();

private:
    std::chrono::time_point<std::chrono::high_resolution_clock> start;

    void compute_aspect();
};
}  // namespace fox
```

## Public API

The game and the editor usually call into the engine via namespace `fox::api::`, eliminating the obsolete single api entry point, making the engine ubiquitous for users.

To see function bindings and some function implementations, the game includes all header files from `engine/public/`. This is a collection of API declarations that is what the game developers can use. These public files also include functions that are impossible to export, specifically tempalates, especially for EnTT - therefore part of the EnTT wrapper implementation that cannot be private is public.

To compile, all modules have to statically link against the aforementioned little .lib stub generated from the engine for the purpose of exporting external functions.

For example `pentafox/api.hpp`:

```cpp
#pragma once

#define GLM_ENABLE_EXPERIMENTAL

#include "services/services.hpp"
#include "services/debug.hpp"
#include "services/input.hpp"
#include "services/assets.hpp"
#include "core/result.hpp"
#include "core/time.hpp"
#include "core/files.hpp"
#include "core/math.hpp"
#include "core/log.hpp"
#include "core/hash.hpp"
#include "ecs/ecs.hpp"
#include "ecs/components.hpp"
#include "reflection/inspector.hpp"
#include "reflection/types.hpp"
#include "colors.hpp"
#include "common.hpp"

namespace fox
{
// forward declarations
class ModuleLibrary;
class Loader;

enum class ModuleKind
{
    Game,
    Plugin
};

// plugin (module)
class IModule
{
public:
    ModuleKind kind = ModuleKind::Plugin;

    virtual void loaded() {};
    virtual void init() {};
    virtual void begin_frame() {};
    virtual void update() {};
    virtual void end_frame() {};

    IModule() = default;
    IModule(const IModule&) = delete;
    IModule(IModule&&) = delete;
    IModule& operator=(const IModule&) = delete;
    IModule& operator=(IModule&&) = delete;
    virtual ~IModule() = default;

    friend class fox::ModuleLibrary;
    friend class fox::Loader;

    bool is_paused = false;
    std::string libname{};

private:
    int id = -1;

protected:
    std::vector<std::string> typenames;

    template <typename TComp>
    void register_type(const std::string& typee_name, fox::TypeMetadata metadata = fox::FOX_TYPEMETA_DEFAULT)
    {
        typenames.push_back(typee_name);
        fox::api::types().register_type<TComp>(typee_name, metadata);
    }

    inline void unregister_all_types()
    {
        for (const auto& _typename : typenames)
        {
            fox::api::types().unregister_type(_typename);
        }
        typenames.clear();
    }
};

class IGame : public fox::IModule
{
public:
    IGame() : fox::IModule()
    {
        kind = ModuleKind::Game;
        world = std::make_unique<fox::World>();
    }
    // inherited destructor
    virtual ~IGame() = default;
    IGame(const IGame&) = delete;
    IGame(IGame&&) = delete;
    IGame& operator=(const IGame&) = delete;
    IGame& operator=(IGame&&) = delete;

    inline fox::World* get_world() { return world.get(); }

private:
    /// <summary>
    /// Game fully owns its own world
    /// </summary>
    std::unique_ptr<fox::World> world;
};

typedef fox::IModule* (*FCreateGameModule)();
}  // namespace fox

#define FOX_REGISTER_GAME(name) \
    extern "C" __declspec(dllexport) fox::IModule* CreateGameModule() { return new name(); }
#define FOX_REGISTER_PLUGIN(name) \
    extern "C" __declspec(dllexport) fox::IModule* CreateGameModule() { return new name(); }

#define FOX_EMPTY_COMPONENT_DUMMY static constexpr std::size_t page_size = ENTT_PACKED_PAGE;

#define FOX_TAG_COMPONENT(name)   \
    struct name                   \
    {                             \
        FOX_EMPTY_COMPONENT_DUMMY \
    };

#define FOX_TAG_COMPONENT_REFLECT(name)                                                           \
    struct name                                                                                   \
    {                                                                                             \
        FOX_EMPTY_COMPONENT_DUMMY;                                                                \
        static void Inspect(void* const data, fox::Inspector* const) { FOX_UNWRAP_OBJECT(name); } \
    };
```

## Dependencies

Engine:
- EnTT
- Vulkan (windows-only)
- nlohmann json
- xsr (glm, stb, sdl3, vulkan utils, imgui (on windows))
- glm
- vld (opt-in, windows-debug-only)
- cgltf (may be removed from runtime-only platforms because of cooking)
- zppbits

Editor:
- pentafox.lib (stub with exports)
- imguizmo
- nfd (for file dialogs)

Game:
- pentafox.lib
- pentafox_api (Interface library, no artifact)

Out of all that, the game developers are explicitly exposed only to glm. Technically they are also implicitly exposed to EnTT, but only for linking purposes - all ECS is implemented in the engine API and it is encouraged to be used this way.

While I dislike that game developers are exposed to EnTT, there is currently no workaround this that I know of, because it seems to be impossible to export templates and I don't have reflection to wrap the entire API with.

## Communication between parts of the engine

`Engine` is a singleton available only within the engine project, and `fox` (`fox::api`, `fox::assets`, `fox::input`, etc) is a namespace available from everywhere. This completely defeats the ideology of having a single window into the engine, that I postulated in the beginning of the project, so I had to abandon that idea entirely and leverage the newborn freedom. It makes it possible to make different parts of the engine more usable and concise. For example, logger uses public api directly to get the target log sink, so when calling log functions users don't need to specify that explicitly, which is what I strived for.

```cpp
LogSink* const sink = fox::api::current_log_sink();
```

Additionally it helps with simplifying classes initialization (no need to pass Engine* or something like that), and all other parts of the engine are accessible via that.

Some code doesn't make sense to group into classes at all, like static api, file system, path evaluation and cooking. Those are free functions in principle, with no state or context, and there can only be one "instance" of each. Now most of the API which is supposed to have one and only one "instance" are pure namespaces for simplicity and extendability.

## ECS

Internally, Pentafox ECS works via entt, thus most principles are inherited.

### World

Registry is stored in a world. World is where the entirety of ECS lives. World is fully owned by the Game:

```cpp
class IGame : public fox::IModule
{
public:
    IGame() : fox::IModule()
    {
        kind = ModuleKind::Game;
        world = std::make_unique<fox::World>();
    }
    virtual ~IGame() { unregister_all_types(); }
    IGame(const IGame&) = delete;
    IGame(IGame&&) = delete;
    IGame& operator=(const IGame&) = delete;
    IGame& operator=(IGame&&) = delete;
    inline fox::World* get_world() { return world.get(); }

private:
    // Game fully owns its own world
    std::unique_ptr<fox::World> world;
};
```

`Loader` then decides which of the loaded modules' world to consider main (pick first module that is of kind game). This way the engine and other parts don't know where the engine comes from and it may be invalid if no world (so, no game) is loaded. This is intentional, because this allows to fully separate ownership of data, meaning I can unload the game, which automatically deletes the world, invalidates Loader's cache, and nothing else has to be cleaned up.

### Entities

fox::Entity is just an alias for entt::entity used for encapsulation, so it is just an id. Alias exists for the purpose of consistency - in my opinion when using an engine it is nicer to only think in terms of the engine instead of also keeping in mind what libraries it uses internally. Yes, EnTT is too large and too unique to encapsulate, but it doesn't mean that users should care about it.

When serializated however, an entity is identified by UUID: a 128-bit integer randomly generated on creation and stored in the `Identity` component. It is 128-bit as a (very) future-proof solution: now I can be 100% sure that every time I generate a UUID it is entirely and universally unique - it has never been and never will be generated. This is achieved via using random device mixed with time stamp for seeding a `mt19937_64` generator.

### Components

Components are just internal entt entries. Pentafox builds a big infrastructure for operating on entities and components more fluently, using pipelines and factories.

I scrapped separation of ~~`Position`, `Rotation` and `Scale`~~ and made `LocalTransform`, `WorldTransform` and `LocalTransformMatrix` components for better usability and consistency, inspired by recent Unity DOTS versions.

```cpp
get_world()->build_entity()
    .add_component<fox::LocalTransform>()
    .scale(0.06f)
    .translate(fox::forward * -3.0f)
    .add_component<fox::MeshRenderer>(fox::assets::get("game.player.model"), fox::assets::get("game.player.material"));
```

Motivation for such design was primarily Unity DOTS, as well as my previous experience with writing pipeline API for Y1 projects. I think pipelining gives a lot of freedom and explicity, and it's very easy to remember, read and write such API.

There is only static inheritance and minimal logic in components:

```cpp
struct LocalTransformMatrix : public glm::mat4
{
    FOX_INSPECT_THIS_META(LocalTransformMatrix, fox::type::MAT4, FOX_REFLECT_NOSAVE | FOX_REFLECT_READONLY)

    using glm::mat4::mat4;
    using glm::mat4::operator=;
    LocalTransformMatrix(glm::mat4 const& m) : glm::mat4(m) {}
};
```

### Systems

There is no single unified definition in my engine that makes a white-and-black difference. But the nomenclature I came up with is:

[1] Systems as classes

Bigger systems can be created as classes, like this:

```cpp
class MoveEnemiesSystem : public fox::System
{
    void body(const fox::Entity /*entity*/, Enemy& /*enemy*/, fox::LocalTransform& transform)
    {
        transform.position += -fox::forward * speed * fox::api::get_delta_time();
        speed = glm::sin(fox::api::get_time_since_startup());
    }

public:
    void init() override {} // doesn't have to be overriden

    void update() override
    {
        entity_filter().select_with<Enemy, fox::LocalTransform>().run_on_all(&MoveEnemiesSystem::body, this);
    }

    float speed = 3.f;

    FOX_INSPECT_BEGIN(MoveEnemiesSystem)
    FOX_ADD_FIELD(speed, fox::type::FLOAT)
    FOX_INSPECT_END
};
```

This allows to easily setup per-entity body function, get required components, filter entities, save and reflect stored data. This flexible approach also allows for future improvements, like adding events/signals, declarative multithreading, read-write access restrictions, etc. (e.g. `run_on_all(fn, args)` could be `run_on_all(fn, args).threads(4).on_finish(fn, args)`).

[2] Systems as anonymous calls

Simpler systems don't need to have a class boilerplate - they can be just a single function call.

```cpp
fox::api::world()->entity_filter().select_with<fox::Camera, fox::LocalTransform>().run_on_all(
    &fox::Renderer::render_camera_component,
    *this);
```

## Game

Game is a module:

```cpp
#include <pentafox/api.hpp>

class MyGame : public fox::IGame
{
public:
    void init() override
    {
    }

    void update() override
    {
    }
};

FOX_REGISTER_GAME(MyGame)
```

The only other thing required for this to work is for the engine to know which module to load (and that the game dll is built against engine export lib).

## Renderer

Renderer is fairly opaque to the engine - the engine only calls update, and then the renderer renders the given world, renders all meshes and cameras.

```cpp
// in engine.cpp update():
fox::World* world = nullptr;
if (current_world(world))
{
    renderer.update(world);  // render the world
}
```

```cpp
class Renderer
{
public:
    // render targets are identified by name
    static inline const std::string DEFAULT_RENDER_TARGET = "main";

    void init(); // NOLINT (may not be static)
    void shutdown(); // NOLINT (may not be static)
    void parse_args(int argc, char** argv);
    bool upload(float time);
    void update(fox::World* const world);

    bool create_window(int width, int height, const std::string& title);

    fox::handle get_render_target_or_create(const std::string& name); // NOLINT (may not be static)

private:
    std::unordered_map<std::string, fox::handle> name_to_render_target;

    void render_mesh_component(fox::Entity id, fox::MeshRenderer& mesh_renderer, fox::WorldTransform& transform); // NOLINT (may not be static)
    void render_camera_component(fox::Entity id, fox::Camera& camera, fox::WorldTransform& world_transform); // NOLINT (may not be static)

    void render_mesh(const glm::mat4& transform, fox::handle mesh, fox::handle material = {}); // NOLINT (may not be static)
    bool render_directional_light(const glm::vec3& direction, const glm::vec3& color); // NOLINT (may not be static)
};
```

## Asset manager

Principles of the asset manager:
- ref-counting system that would load and unload assets based on their use
- garbage collection that unloads all unused assets (may be extended to schedule)
- assets, usable alone but originated from other assets (e.g. Mesh coming from a GLTF) are subassets and have their own refcounting but loading-unloading is wired through their source asset
- assets are cooked into custom binary representation for ease of adding more file formats and optimized and simpler loading
- users only get readonly-data (views) or handles

### RAII, ref-counting

Users get `AssetHandles` which is a custom RAII wrapper (much like a `shared_ptr`) that increments user count on construction and decrements on destruction.

For example, `MeshRenderer` then uses that handle:
```cpp
struct MeshRenderer
{
    fox::AssetHandle mesh{};
    fox::AssetHandle material{};
};
```
So while that component is alive, the handles are as well, naturally bringing RAII and user-counting together. This allows the user to never care about loading and unloading any assets manually, they don't have any `load()` or `unload()` - that is done automatically.

### Table of entries

Asset is identified by its name, always. If name changes, the identity of the asset changes. More specifically, for hash-maps and easy referencing I hash the asset name.

Assets are stored in a table (name hash -> asset entry).

```cpp
struct AssetEntry
{
    std::string name; // identity
    std::string original_path; // if not generated or outsourced, path to the file
    std::vector<int> dependencies; // dependencies are loaded first
    unsigned int ref_count = 0;
    int source_id = -1; // if != -1, refers to another asset that provides data for this
    int id = -1; // hash of name, technically excessive (didn't use to be)
    fox::handle online_handle = -1;  // set on load. Source of truth
    bool always_loaded = false;      // for testing / system resources
    bool is_loaded = false;
    AssetType type; // e.g. Mesh, Texture, Material
    FileType file_type = FileType::None; // e.g. GLTF, Obj, Png
};
```

### Lazy loading

`AssetHandle` doesn't store the resource handle at all. This way I separate asset identity (ID) and GPU handle. An asset can have multiple users, can be requested to load and unload asynchronously (potentially), for example, while the mesh renderer is up and running with an empty handle. This allows for a lot of flexibility: reloading an asset requires no rewiring and updating, scheduled asset loading/unloading doesn't affect users, and users don't actually know when their assets are loaded.

```cpp
fox::handle fox::AssetHandle::get_handle() const
{
    const fox::AssetEntry* entry = fox::engine().assets.try_get_entry(id);
    if (entry)
    {
        return entry->online_handle;
    }
    return INVALID_HANDLE;
}
```

### Garbage collection

This is part of the lazy unloading. Garbage collection allows to schedule and customize automatic asset unloading. It only triggers for assets that have no users and are currently loaded. The current, simplest form of GC is just an end-of-frame collection of whatever is not needed, but this design allows to easily extend it to account for time, memory use and other special rules to fine-tune GC to be much more efficient at keeping balance between memory use and loading throughput.

```cpp
int fox::Assets::collect_garbage()
{
    int total_unloaded = 0;
    while (!requests_unload.empty())
    {
        fox::RequestAssetUnload req = requests_unload.front();
        const fox::AssetEntry* entry = try_get_entry(req.id);
        if (entry)
        {
            if (entry->is_loaded && entry->ref_count == 0)  // loaded and unused
            {
                unload(req.id);
                ++total_unloaded;
            }
        }
        requests_unload.pop();
    }
    return total_unloaded;
}
```

### Readonly data for previewing

If users want to read asset entries, they can request a `ReadonlyAssetView` which is simply a mirror struct of the real `AssetEntry` copied over. This way users have strongly-typed clear struct that has no write access into the actual underlying structure. This is used by the Editor, for example.

Reason for that is that I don't want to expose implementation and backend to the users as much as possible. Asset entries are managed entirely by the asset manager fully automatically, users should never touch the internals.

### Cooking

#### Overview

Cooking is a process of converting data from one format to another, in this case I convert common asset formats (GLTF, Obj, image formats (Png, Jped, etc)) into a binary blob of raw data. `Raw data` is just unprocessed data, formatted specifically for the engine. So while GLTF packs mesh in specifics buffers somewhere, and splits them by primitives and attributes, my mesh data is just raw data all in one place - indices, vertices, uvs, etc. This allows me to dump data in and out very quickly, and game doesn't need to know how to parse GLTFs or other formats. Plus, as long as I can make a function to convert desired file format into my format, I can add any new file formats very easily.

#### Reasons

I decided to do it for these reasons:
- Adding more file formats is always constant difficulty (instead of updating the entire matrix of wiring each file format to read/write with each asset type)
- Game code will be free of GLTF, Obj and FBX parsing, and loading models will be faster, since loading my binary blob is as easy as dumping the data into the corresponding asset.

#### Table of entries

The aforementioned table of entries is the runtime verison, but during cooking the offline version of it is generated, similar to this:

```json
{
    "meta": {
        "time_cooked": 1793186845,
        "version": 1
    },
    "table": [
        {
            "dependencies": [
                1190237052
            ],
            "file_type": 1,
            "id": 1420602488,
            "name": "game.enemy.material",
            "path": "",
            "source_id": -1,
            "type": 2
        }
    ]
}
```

The offline table of entries and be imported into the online table and vice versa. If possible, assets will be overriden.

#### Forward declaration

Users may declare assets lazily, promising the engine that they will be imported later:

```cpp
engine.assets().get_lazy("game.player.model")
```

This declares a new asset entry with the given name. This alone is not enough information to create a valid asset of course, but enough to generate an asset entry with a unique identity. Later, when user imports an asset or asset table with the same name, it will be replaced, so the hash will be the same, all handles referencing it will remain valid, but the data will be imported anew. This allows to get asset entries safely without enforcing proper importing or loading beforehand.

#### Subasset propagation

GLTF usually contains multiple what I call subassets - meshes, textures, materials. Those automatically become separate subassets with separate refcounting. When a GLTF is cooked, it automatically generates all necessary asset entries for all found and supported subassets, and cooks them too.

## Reflection & Serialization

### Inspection

The two features come particularly close together in my mind. Unless doing scripting or some very specific tasks, reflection is only used for serializing (presenting) data into a different format.

More out of absence of exposure to existing ideas and solutions than out of clear vision, I made my own reflection system, without using entt meta or cereal.

It is similar to the visitor pattern: a reflected struct or class can be visited by an abstract Inspector. When that happens user can do whatever. For example:

```cpp
static void Inspect(void* const data, fox::Inspector* const inspector)
{
    LocalTransform* obj = reinterpret_cast<LocalTransform*>(data);
    inspector->add_field("position",
                         fox::type::FLOAT3,
                         sizeof(obj->position),
                         static_cast<void*>(&obj->position),
                         static_cast<fox::Reflags>(fox::FOX_REFLECT_DEFAULT));
    inspector->add_field("rotation",
                         fox::type::QUAT,
                         sizeof(obj->rotation),
                         static_cast<void*>(&obj->rotation),
                         static_cast<fox::Reflags>(fox::FOX_REFLECT_DEFAULT));
    inspector->add_field("scale",
                         fox::type::FLOAT3,
                         sizeof(obj->scale),
                         static_cast<void*>(&obj->scale),
                         static_cast<fox::Reflags>(fox::FOX_REFLECT_DEFAULT));
}
```

`add_field` can then read from or write into the given field, present it in the GUI or json or binary.

Same inspection can be written more concisely as:

```cpp
struct LocalTransform
{
    glm::vec3 position{};
    glm::quat rotation = glm::quat::wxyz(1.f, 0.f, 0.f, 0.f);
    glm::vec3 scale{1.f};


    FOX_INSPECT_BEGIN(LocalTransform)
    FOX_ADD_FIELD(position, fox::type::FLOAT3)
    FOX_ADD_FIELD(rotation, fox::type::QUAT)
    FOX_ADD_FIELD(scale, fox::type::FLOAT3)
    FOX_INSPECT_END
};
```

This inspection is used for both Editor read-write serialization, as well as for scene saving and loading.

### Registering

Type has to be registered for further use:

```cpp
FOX_REGISTER_TYPE(InGameComponent);
```

This assembles multiple function pointers, abstracting away template types and entt, exposing simple API:

```cpp
template <typename TComp>
void register_type(const std::string& typee_name)
{
    auto hash = type_hash<TComp>();
    auto fn_serialize = &TComp::Inspect;
    auto fn_deserialize = [](entt::registry& reg, entt::entity entity, fox::Inspector* reader)
    {
        TComp comp{};
        TComp::Inspect(&comp, reader);
        reg.emplace_or_replace<TComp>(entity, comp);
    };
    auto fn_create = [](entt::registry& reg, entt::entity entity) -> void*
    {
        TComp comp{};
        return static_cast<void*>(&reg.emplace_or_replace<TComp>(entity, comp));
    };
    TypeEntry entry{hash, typee_name, fn_serialize, fn_deserialize, fn_create};

    typehash_to_entry.emplace(hash, std::move(entry));
    name_to_typehash.emplace(typee_name, hash);
    printf("Reflection: Registered type named <%s> with type hash (%d)", typee_name.c_str(), hash);
}
```

Type is identified via its hash, generated via pretty function under the hood in entt. This ensures stability across builds, platforms and DLLs.

## Packaging

Package can be created by running my `package.cmake` script with specified parameters. I decided to write it in cmake and not python or C++ intentionally, because cmake is already a dependency in the project, so I am not introducing anything new, and from my previous year's experience in block D (making an UE building pipeline) I knew that it is essential that packaging can be run from outside the engine and the editor for convenience, automation and potential extension. Passing parameters into the script instead of reading some sort of cache (e.g. Cmake config cache) makes it entirely independent of external data and easy to setup and use.
