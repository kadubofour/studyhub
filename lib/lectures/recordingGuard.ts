'use client'

// Whether a lecture is recording on this page, so leaving it (through the app's navigation)
// can ask first: leaving stops the recording
let recording = false
export const setRecording = (on: boolean) => { recording = on }
export const isRecording = () => recording
