workspace "MtdrSpring - Task Manager AI" "Architecture model for the Task Manager with AI RAG Context" {

    model {
        developer = person "Developer" "Manages tasks and views personal KPIs via Telegram." "Person"
        manager = person "Manager" "Monitors team performance via the web dashboard, AI Insights and Semantic Chat." "Person"
        admin = person "Admin" "Creates and manages users, teams and projects via the web dashboard." "Person"

        telegram = softwareSystem "Telegram" "External interface for bot interactions." "External System"
        gemini = softwareSystem "Google Gemini API" "LLM used for Embeddings and Text Generation." "External System"

        taskManager = softwareSystem "Task Manager AI" "Main System" {
            reactApp = container "React Frontend" "Web Dashboard for team management, KPI visualization and AI Semantic Chat." "React 18" "Web Browser"

            apiApp = container "Spring Boot Backend" "Processes business logic and AI orchestration." "Java 17, Spring Boot" {
                kpiController = component "Kpi Controller" "Exposes endpoints for metrics." "Spring REST"
                chatController = component "Manager Chat Controller" "Entry point for AI Semantic Chat." "Spring REST"
                botLogic = component "MyTodoListBot" "Telegram bot event handler." "TelegramBots SDK"
                adminController = component "Admin Controller" "Exposes endpoints for user, team and project management." "Spring REST"

                kpiService = component "Kpi Service" "Calculates weighted productivity scores." "Spring Service"
                geminiService = component "Gemini Service" "Orchestrates AI prompts and async calls." "Spring Service"
                embeddingService = component "Embedding Service" "Generates vector representations." "Spring Service"
                chatService = component "Manager Chat Service" "Orchestrates RAG flow." "Spring Service"
                adminService = component "Admin Service" "Handles user, team and project creation logic." "Spring Service"

                dataRepo = component "JPA Repositories" "Data access layer using Spring Data JPA." "Spring Data JPA"
            }

            database = container "Oracle Autonomous DB" "Persistent storage for tasks, users, teams and embeddings." "Oracle ADB" "Database"
        }

        # --- Relationships ---

        developer -> telegram "Uses commands /kpi, /tasks, /insights"

        manager -> reactApp "Views team KPIs, AI Insights and Semantic Chat"

        admin -> reactApp "Creates and manages users, teams and projects"

        telegram -> botLogic "Sends Webhook Updates"
        reactApp -> kpiController "API Calls (JSON/HTTPS)"
        reactApp -> chatController "Sends semantic queries (JSON/HTTPS)"
        reactApp -> adminController "Manages users, teams and projects (JSON/HTTPS)"

        botLogic -> kpiService "Requests KPI data for developer"

        kpiController -> kpiService "Requests calculations"

        chatController -> chatService "Uses"
        chatService -> embeddingService "Requests query embedding"
        embeddingService -> gemini "Generates vector" "HTTPS"
        chatService -> dataRepo "Retrieves top-K similar tasks"
        chatService -> geminiService "Sends context-augmented prompt"

        kpiService -> geminiService "Provides context for sprint insights"
        geminiService -> gemini "Async LLM request" "HTTPS"

        adminController -> adminService "Uses"
        adminService -> dataRepo "Creates and updates users, teams and projects"

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
        # 1. System Landscape
        systemLandscape "Landscape" {
            include *
            autoLayout lr
        }

        # 2. System Context
        systemContext taskManager "SystemContext" {
            include *
            autoLayout lr
        }

        # 3. Containers
        container taskManager "Containers" {
            include *
            autoLayout lr
        }

        # 4. Components
        component apiApp "Components" {
            include *
            autoLayout lr
        }

        # 5. Deployment
        deployment taskManager "Production" "Deployment" {
            include *
            autoLayout lr
        }

        # 6a. Dynamic - RAG Semantic Chat Flow
        dynamic apiApp "RAG_Insight_Flow" "Shows how the system retrieves context before calling the LLM." {
            chatController -> chatService "1. User query received"
            chatService -> embeddingService "2. Convert query to vector"
            embeddingService -> gemini "3. Call embedding API"
            chatService -> dataRepo "4. Semantic search for relevant tasks"
            chatService -> geminiService "5. Call LLM with retrieved context"
            geminiService -> gemini "6. Generate final response"
            autoLayout lr
        }

        # 6b. Dynamic - KPI Calculation Flow
        dynamic apiApp "KPI_Calculation_Flow" "Shows how KPI metrics are calculated and enriched with AI insights." {
            kpiController -> kpiService "1. Request KPI calculation for sprint"
            kpiService -> dataRepo "2. Fetch tasks and user assignments"
            dataRepo -> kpiService "3. Return raw task data"
            kpiService -> geminiService "4. Request AI-generated sprint insight"
            geminiService -> gemini "5. Call Gemini API asynchronously"
            gemini -> geminiService "6. Return insight text"
            geminiService -> kpiController "7. Insight stored and ready"
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
