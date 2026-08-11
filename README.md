# Rust Pudding

Executable integration proofs for the Tsonic Rust target.

The suite mirrors the target-neutral behavior proven by
`proof-is-in-the-pudding` and adds Rust-owned contracts that have no C#
equivalent: ownership and borrowing, `Option`/`Result`, traits, Cargo project
generation, safe typed-location aliasing, transitive Rust generic-contract
reconstruction, and installed Rust capability packages.

Every project is compiled from TypeScript to a fresh Rust/Cargo project, then
checked with the native Rust toolchain. Binary proofs run and must satisfy
their own exact assertions. Generated source must be deterministic,
`cargo fmt --check` clean, Clippy-clean, and free of fallback runtime
reflection or dynamic dispatch.

The native Cargo-provider proof uses a user-owned `Cargo.toml`, imports
`HashMap`/`HashSet`/`Vec` through Rust standard-library virtual modules, and
imports a renamed local Cargo dependency through
`@tsonic/rust/crates/widget_alias/*.js`. It proves exact generic constructors,
methods, mutable fields, free functions, nested modules, selected features,
`Option`, `Vec`, and `HashMap` results through generated Rust and native Cargo
execution. Tsonic must leave the user manifest byte-for-byte untouched.

Run the complete bounded gate with:

```sh
./scripts/verify-all.sh
```

Filtered or direct project runs are development aids only; they are not the
acceptance gate.
