use std::collections::HashMap;
use std::future::Future;

pub struct Widget<T> {
    pub count: i32,
    value: T,
}

impl<T> Widget<T> {
    pub fn new(value: T) -> Self {
        Self { count: 1, value }
    }

    pub fn replace(&mut self, value: T) -> T {
        std::mem::replace(&mut self.value, value)
    }

    pub fn into_value(self) -> T {
        self.value
    }
}

pub fn double(value: i32) -> i32 {
    value * 2
}

pub fn identity<T>(value: T) -> T {
    value
}

pub fn choose_borrowed<'a, 'b: 'a, T: ?Sized>(left: &'a T, _right: &'b T) -> &'a T {
    left
}

pub fn preserve_borrowed<'a, T: ?Sized + 'a>(value: &'a T) -> &'a T {
    value
}

pub fn require_fn<F: Fn()>(callback: F) {
    callback();
}

pub fn require_fn_mut<F: FnMut()>(mut callback: F) {
    callback();
}

pub fn require_fn_once<F: FnOnce()>(callback: F) {
    callback();
}

pub fn require_local_future<F: Future<Output = ()>>(future: F) {
    drop(future);
}

pub fn require_send_static_future<F>(future: F)
where
    F: Future<Output = ()> + Send + 'static,
{
    drop(future);
}

pub fn maybe_positive(value: i32) -> Option<i32> {
    (value > 0).then_some(value)
}

pub fn duplicate(value: i32) -> Vec<i32> {
    vec![value, value]
}

pub fn singleton_map(value: i32) -> HashMap<String, i32> {
    HashMap::from([(String::from("value"), value)])
}

pub unsafe fn dangerous(value: i32) -> i32 {
    value
}

pub unsafe fn first_byte(pointer: *const u8) -> u8 {
    unsafe { *pointer }
}

static BYTE: u8 = 23;

pub fn byte_ptr() -> *const u8 {
    &BYTE
}

#[cfg(feature = "extras")]
pub fn featured(value: i32) -> i32 {
    value + 100
}

pub mod math {
    pub fn triple(value: i32) -> i32 {
        value * 3
    }
}
