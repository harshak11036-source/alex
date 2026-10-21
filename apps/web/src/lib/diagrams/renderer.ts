import { execSync } from 'child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface DiagramRenderResult {
  success: boolean
  svg?: string
  error?: string
}

export class DiagramRenderer {
  private static tempDir: string

  static getTempDir(): string {
    if (!this.tempDir) {
      this.tempDir = mkdtempSync(join(tmpdir(), 'alex-diagrams-'))
    }
    return this.tempDir
  }

  static async renderMermaid(code: string): Promise<DiagramRenderResult> {
    const tempDir = this.getTempDir()
    const inputFile = join(tempDir, `mermaid-${Date.now()}.mmd`)
    const outputFile = join(tempDir, `mermaid-${Date.now()}.svg`)

    try {
      writeFileSync(inputFile, code)

      const { execSync } = await import('child_process')
      const cliPath = join(process.cwd(), 'node_modules', '.bin', 'mmdc')
      
      execSync(`"${cliPath}" -i "${inputFile}" -o "${outputFile}" -b transparent`, {
        stdio: 'pipe',
        timeout: 30000,
      })

      const fs = await import('fs')
      const svg = fs.readFileSync(outputFile, 'utf-8')
      
      fs.unlinkSync(inputFile)
      fs.unlinkSync(outputFile)

      return { success: true, svg }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Mermaid rendering failed' 
      }
    }
  }

  static async renderGraphviz(code: string): Promise<DiagramRenderResult> {
    const tempDir = this.getTempDir()
    const inputFile = join(tempDir, `graphviz-${Date.now()}.dot`)
    const outputFile = join(tempDir, `graphviz-${Date.now()}.svg`)

    try {
      writeFileSync(inputFile, code)

      const { execSync } = await import('child_process')
      execSync(`dot -Tsvg "${inputFile}" -o "${outputFile}"`, {
        stdio: 'pipe',
        timeout: 30000,
      })

      const fs = await import('fs')
      const svg = fs.readFileSync(outputFile, 'utf-8')
      
      fs.unlinkSync(inputFile)
      fs.unlinkSync(outputFile)

      return { success: true, svg }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Graphviz rendering failed' 
      }
    }
  }

  static async renderPlantUML(code: string): Promise<DiagramRenderResult> {
    const tempDir = this.getTempDir()
    const inputFile = join(tempDir, `plantuml-${Date.now()}.puml`)
    const outputFile = join(tempDir, `plantuml-${Date.now()}.svg`)

    try {
      writeFileSync(inputFile, code)

      const { execSync } = await import('child_process')
      const plantumlJar = join(process.cwd(), 'node_modules', 'plantuml', 'plantuml.jar')
      
      execSync(`java -jar "${plantumlJar}" -tsvg "${inputFile}" -o "${tempDir}"`, {
        stdio: 'pipe',
        timeout: 30000,
      })

      const fs = await import('fs')
      const svg = fs.readFileSync(outputFile, 'utf-8')
      
      fs.unlinkSync(inputFile)
      fs.unlinkSync(outputFile)

      return { success: true, svg }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'PlantUML rendering failed' 
      }
    }
  }

  static async render(diagramType: string, code: string): Promise<DiagramRenderResult> {
    switch (diagramType) {
      case 'mermaid':
        return this.renderMermaid(code)
      case 'graphviz':
        return this.renderGraphviz(code)
      case 'plantuml':
        return this.renderPlantUML(code)
      default:
        return { success: false, error: `Unsupported diagram type: ${diagramType}` }
    }
  }

  static cleanup() {
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true })
      } catch {}
      this.tempDir = ''
    }
  }
}

export async function renderDiagramFromCode(
  type: 'mermaid' | 'graphviz' | 'plantuml',
  code: string
): Promise<{ svg: string; width: number; height: number }> {
  const result = await DiagramRenderer.render(type, code)
  
  if (!result.success || !result.svg) {
    throw new Error(result.error || 'Failed to render diagram')
  }

  const widthMatch = result.svg.match(/width="(\d+(?:\.\d+)?)"/)
  const heightMatch = result.svg.match(/height="(\d+(?:\.\d+)?)"/)

  return {
    svg: result.svg,
    width: widthMatch ? parseFloat(widthMatch[1]) : 800,
    height: heightMatch ? parseFloat(heightMatch[1]) : 600,
  }
}

