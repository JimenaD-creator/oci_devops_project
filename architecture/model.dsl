workspace "MtdrSpring - Task Manager AI" "Architecture model for the Task Manager with AI RAG Context" {

    model {
        developer = person "Developer" "Manages tasks and views personal KPIs." "Person"
        manager = person "Manager" "Monitors team performance via AI insights and Semantic Chat." "Person"
        
        telegram = softwareSystem "Telegram" "External interface for bot interactions." "External System"
        gemini = softwareSystem "Google Gemini API" "LLM used for Embeddings and Text Generation." "External System"

        taskManager = softwareSystem "Task Manager AI" "Main System" {
            reactApp = container "React Frontend" "Web Dashboard for KPI visualization." "React 18" "Web Browser"
            
            apiApp = container "Spring Boot Backend" "Processes business logic and AI orchestration." "Java 17, Spring Boot" {
                kpiController = component "Kpi Controller" "Exposes endpoints for metrics." "Spring REST"
                chatController = component "Manager Chat Controller" "Entry point for AI Semantic Chat." "Spring REST"
                botLogic = component "MyTodoListBot" "Telegram bot event handler." "TelegramBots SDK"
                
                kpiService = component "Kpi Service" "Calculates weighted productivity scores." "Spring Service"
                geminiService = component "Gemini Service" "Orchestrates AI prompts and async calls." "Spring Service"
                embeddingService = component "Embedding Service" "Generates vector representations." "Spring Service"
                chatService = component "Manager Chat Service" "Orchestrates RAG flow." "Spring Service"
                
                dataRepo = component "JPA Repositories" "Data access layer using Spring Data JPA." "Spring Data JPA"
            }

            database = container "Oracle Autonomous DB" "Persistent storage for tasks and embeddings." "Oracle ADB" "Database"
        }

        developer -> reactApp "Uses"
        manager -> telegram "Uses commands /kpi, /insights"
        manager -> chatController "Asks semantic questions about the project"
        
        reactApp -> kpiController "API Calls (JSON/HTTPS)"
        telegram -> botLogic "Sends Webhook Updates"
        
        botLogic -> kpiService "Requests data"
        kpiController -> kpiService "Requests calculations"
        
        chatController -> chatService "Uses"
        
        chatService -> embeddingService "Requests query embedding"
        embeddingService -> gemini "Generates vector" "HTTPS"
        chatService -> dataRepo "Retrieves top-K similar tasks"
        chatService -> geminiService "Sends context-augmented prompt"
        
        kpiService -> geminiService "Provides context for sprint insights"
        geminiService -> gemini "Async LLM request" "HTTPS"
        
        dataRepo -> database "SQL/JDBC"
        embeddingService -> dataRepo "Stores and updates Task Embeddings"
        
        deploymentEnvironment "Production" {
            deploymentNode "Oracle Cloud Infrastructure" {
                containerInstance database
                
                deploymentNode "Oracle Kubernetes Engine (OKE)" {
                    deploymentNode "Frontend Pod" {
                        containerInstance reactApp
                    }
                    deploymentNode "Backend Pod" {
                        containerInstance apiApp
                    }
                }
            }
        }
    }

    views {
        systemContext taskManager "SystemContext" {
            include *
            autoLayout lr
        }

        container taskManager "Containers" {
            include *
            autoLayout lr
        }

        component apiApp "Components" {
            include *
            autoLayout lr
        }

        deployment taskManager "Production" "Deployment" {
            include *
            autoLayout lr
        }

        dynamic apiApp "RAG_Insight_Flow" "Shows how the system retrieves context before calling the LLM." {
            chatController -> chatService "1. User query received"
            chatService -> embeddingService "2. Convert query to vector"
            embeddingService -> gemini "3. Call embedding API"
            chatService -> dataRepo "4. Semantic search for relevant tasks"
            chatService -> geminiService "5. Call LLM with retrieved context"
            geminiService -> gemini "6. Generate final response"
            autoLayout lr
        }

        styles {
            element "External System" {
                background #999999
                color #ffffff
            }
            element "Database" {
                shape Cylinder
            }
            element "Web Browser" {
                shape WebBrowser
            }
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
        }
    }
}