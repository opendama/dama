allprojects {
    repositories {
        google()
        mavenCentral()
    }
    // Pin androidx.core below 1.18 so compileSdk 35 + AGP 8.7 stay valid
    // (1.18+ requires compileSdk 36 / AGP 8.9 which need a fresh Maven download).
    configurations.configureEach {
        resolutionStrategy {
            force("androidx.core:core:1.15.0")
            force("androidx.core:core-ktx:1.15.0")
        }
    }
}

val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
